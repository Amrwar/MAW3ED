import NextAuth, { CredentialsSignin } from "next-auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { accountForVerifiedPhone, verifyLoginCode } from "@/lib/auth/login-code";
import { USE_PASSWORD_CODE, phoneSignInRefusedFor } from "@/lib/auth/phone-signin-policy";
import { normalisePhone } from "@/lib/phone";
import { SESSION_MAX_AGE_SECONDS, needsRecheck, sessionRevoked } from "@/lib/security/session-policy";
import { googleProfileAccepted, googleProviders } from "@/lib/auth/google";
import { decideGoogleSignIn } from "@/lib/auth/google-signin";

/** Owners and admins sign in by password or Google (lib/auth/phone-signin-policy.ts). */
class UsePasswordSignIn extends CredentialsSignin {
  code = USE_PASSWORD_CODE;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS, updateAge: 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) })
          .safeParse(credentials);

        if (!parsed.success) return null;

        // Rate limited here rather than in a route, because NextAuth
        // owns /api/auth/callback/credentials and this is the only
        // code of ours every attempt passes through.
        //
        // Keyed on the email, not the caller's address: an attacker
        // rotating IP addresses still cannot grind one account, and an
        // office behind one NAT is not locked out because a colleague
        // mistyped. Returning null is the same answer a wrong password
        // gets, so the limit cannot be used to tell them apart.
        // Both: per account (the same bucket as the app's login, so web and
        // app share it) and per caller across accounts (final audit S-01).
        const limited = await rateLimit("login", parsed.data.email.trim().toLowerCase());
        const byCaller = limited.ok ? await rateLimit("loginCaller") : limited;
        if (!limited.ok || !byCaller.ok) {
          log.warn("[auth] login rate limited");
          return null;
        }

        // Case-insensitive: an address typed "Amr@X.com" at sign-up and
        // "amr@x.com" at login is the same mailbox.
        const user = await db.user.findFirst({
          where:   { email: { equals: parsed.data.email, mode: "insensitive" } },
          include: { business: { select: { id: true } } },
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        return {
          id:         user.id,
          email:      user.email,
          name:       user.name,
          businessId: user.business?.id ?? null,
        };
      },
    }),

    /**
     * Customers sign in with a code sent to their phone.
     *
     * The code is verified here rather than in a route that then issues
     * a session, so there is exactly one place a phone can become a
     * logged-in user and no endpoint that hands out sessions on its own.
     *
     * verifyLoginCode consumes the code, so a replay of the same
     * request fails — the second attempt finds nothing to check.
     */
    Credentials({
      id:   "phone-otp",
      name: "Phone",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        code:  { label: "Code",  type: "text" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ phone: z.string().min(6), code: z.string().min(4).max(10) })
          .safeParse(credentials);

        if (!parsed.success) return null;

        // The same buckets the app's /api/auth/mobile/otp spends, so the
        // website is not the cheaper door to guess through. Per address
        // first, then per number: the code itself caps guesses, but
        // without these somebody could request and guess codes for a
        // number as fast as the cooldown lets them, from one machine or
        // many. A null is what a wrong code gets, so the limit says
        // nothing about which it was.
        const byCaller = await rateLimit("phoneOtp");
        if (!byCaller.ok) {
          log.warn("[auth] phone sign-in rate limited (caller)");
          return null;
        }
        // Keyed by number AND address: keyed by number alone, anybody
        // could spend a stranger's bucket with junk and lock them out of
        // signing in. Guesses at one code are capped by its attempts.
        const phone = normalisePhone(parsed.data.phone);
        if (phone) {
          const byPhone = await rateLimit("phoneOtpVerify", `${phone}:${await callerKey()}`);
          if (!byPhone.ok) {
            log.warn("[auth] phone sign-in rate limited (number)");
            return null;
          }
        }

        const result = await verifyLoginCode(parsed.data.phone, parsed.data.code);
        if (!result.ok) return null;

        // Decided before accountForVerifiedPhone, which stamps the number
        // as verified: a refused attempt must not record a new holder.
        if (await phoneSignInRefusedFor(result.phone)) {
          log.warn("[auth] phone sign-in refused for an owner or admin account");
          throw new UsePasswordSignIn();
        }
        const account = await accountForVerifiedPhone(result.phone);

        const user = await db.user.findUnique({
          where:   { id: account.id },
          include: { business: { select: { id: true } } },
        });
        if (!user) return null;

        return {
          id:         user.id,
          email:      user.email,
          name:       user.name,
          businessId: user.business?.id ?? null,
        };
      },
    }),

    // "Continue with Google", only once AUTH_GOOGLE_ID and
    // AUTH_GOOGLE_SECRET are set (lib/auth/google.ts).
    ...googleProviders(),
  ],
  events: {
    // Google has just proved the address (the signIn callback below
    // refuses one it has not), so an account whose email is that address
    // counts as verified, which is what readiness and the verify-email
    // banner ask about. An account that was unverified until now had its
    // password removed before the link (lib/auth/google-signin.ts), so
    // nothing set by whoever registered the address survives this.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.id || !googleProfileAccepted(profile)) return;
      const email = String(profile!.email).trim().toLowerCase();
      await db.user
        .updateMany({ where: { id: user.id, email, emailVerified: null }, data: { emailVerified: new Date() } })
        .catch((e) => log.warn("[auth] could not mark Google email verified", { error: String(e) }));
    },
  },
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Google only; the Credentials providers decide in authorize().
     * Verified addresses only, never linked into an account somebody
     * else left signed in, and an unverified pre-registered account is
     * disarmed before it is linked (lib/auth/google-signin.ts). A refusal
     * is the address of the sign-in page that explains it.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      return decideGoogleSignIn(account, profile);
    },

    async jwt({ token, user, trigger }) {
      // On first sign-in, embed user data into token. For Google, `user`
      // is the adapter's row and has no businessId, so it starts null;
      // the recheck below then fills businessId, phone and adminRole at
      // once, because a token minted at sign-in has no `resolved` yet.
      if (user) {
        token.id         = user.id ?? "";
        token.businessId = (user as { businessId?: string | null }).businessId ?? null;
        // When this session began, kept by us rather than read from
        // `iat`, which moves every time the cookie is re-issued. It is
        // what a later revocation is compared with.
        token.signedInAt = Date.now();
      }

      // Re-fetch when explicitly triggered (e.g. after onboarding), once
      // for a token minted before this field existed, and every few
      // minutes after that (lib/security/session-policy.ts): a token is
      // valid for a month, and the account behind it can be revoked,
      // lose a role or be deleted meanwhile. Returning null ends the
      // session.
      //
      // Deliberately not "whenever businessId is falsy": a customer has
      // no business and never will, so that condition fired a database
      // query on every single request for them.
      const recheck = trigger === "update" || !token.resolved || needsRecheck(token.checkedAt as number | undefined);
      if (recheck && token.id) {
        const dbUser = await db.user.findUnique({
          where:   { id: token.id as string },
          select:  { phone: true, adminRole: true, sessionsRevokedAt: true, business: { select: { id: true } } },
        });
        if (!dbUser) return null;
        if (sessionRevoked(token.signedInAt as number | undefined, dbUser.sessionsRevokedAt)) {
          log.info("[auth] web session refused: revoked", { userId: token.id });
          return null;
        }
        token.businessId = dbUser.business?.id ?? null;
        token.phone      = dbUser.phone ?? null;
        // Carried for the navigation only. Access is decided by
        // lib/admin/guard, which reads the role from the database on
        // every request — a token minted at sign-in cannot be trusted
        // to say whether somebody is still an administrator.
        token.adminRole  = dbUser.adminRole ?? null;
        token.resolved   = true;
        token.checkedAt  = Date.now();
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id         = token.id as string;
      session.user.businessId = (token.businessId as string | null | undefined) ?? null;
      session.user.phone      = (token.phone as string | null | undefined) ?? null;
      session.user.adminRole  = (token.adminRole as string | null | undefined) ?? null;
      return session;
    },
  },
});
