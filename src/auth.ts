import NextAuth from "next-auth";
import { callerKey, rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { accountForVerifiedPhone, verifyLoginCode } from "@/lib/auth/login-code";
import { normalisePhone } from "@/lib/phone";
import { SESSION_MAX_AGE_SECONDS, needsRecheck, sessionRevoked } from "@/lib/security/session-policy";

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
        const limited = await rateLimit("login", parsed.data.email);
        if (!limited.ok) {
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
  ],
  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user, trigger }) {
      // On first sign-in, embed user data into token
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
