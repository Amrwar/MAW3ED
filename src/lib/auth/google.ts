import Google, { type GoogleProfile } from "next-auth/providers/google";

/**
 * "Continue with Google".
 *
 * Off until both credentials are set, so a deployment that has not been
 * through Google's console yet behaves exactly as before: no provider
 * registered, no button drawn (the (auth) layout asks googleEnabled()).
 *
 * The redirect URI to register with Google is
 * https://www.maw3ed.net/api/auth/callback/google (see .env.example).
 */

/** Both credentials, or null when Google sign-in is not configured. */
function googleCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.AUTH_GOOGLE_ID?.trim();
  const clientSecret = process.env.AUTH_GOOGLE_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function googleEnabled(): boolean {
  return googleCredentials() !== null;
}

/**
 * The provider list to spread into NextAuth's: empty when unconfigured.
 *
 * allowDangerousEmailAccountLinking: an owner who signed up with a
 * password and later presses "Continue with Google" with the same
 * address lands in their own account instead of on an error. It is only
 * safe because Google has proved the address: the signIn callback in
 * src/auth.ts refuses any Google profile whose email_verified is not
 * true (googleProfileAccepted below).
 */
export function googleProviders() {
  const credentials = googleCredentials();
  if (!credentials) return [];
  return [
    Google({
      ...credentials,
      allowDangerousEmailAccountLinking: true,
      // Only the columns User has: the adapter writes this object
      // straight into a new row. Emails are stored lower-cased (a unique
      // index on lower(email) holds production to it), and the adapter's
      // lookup by email is exact, so the mapping lower-cases too.
      profile(profile: GoogleProfile) {
        return {
          id: profile.sub,
          name: profile.name?.trim() || null,
          email: profile.email?.trim().toLowerCase() || null,
          image: profile.picture || null,
        };
      },
    }),
  ];
}

/**
 * Whether a Google profile may sign in: only with an address Google says
 * it has verified. Without this a Google account carrying somebody
 * else's unverified work address would be linked, by that address, to
 * their Maw3ed account.
 */
export function googleProfileAccepted(profile: { email?: string | null; email_verified?: unknown } | null | undefined): boolean {
  return profile?.email_verified === true && typeof profile.email === "string" && profile.email.trim().length > 0;
}
