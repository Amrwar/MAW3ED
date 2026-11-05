/**
 * Which explanation (t.auth.errors) fits the ?error= a sign-in came back
 * with.
 *
 * Two sources: NextAuth's own types (@auth/core errors.js, clientErrors,
 * plus "Configuration" for everything it keeps to itself), which arrive
 * on /login, its error page; and our Google refusals (lib/auth/
 * google-signin.ts), which arrive on /login or /account-login depending
 * on where the sign-in started. Anything else in the parameter gets the
 * plain "something went wrong", never the raw value: it is the address
 * bar, and anybody can write in it.
 */
export type AuthErrorKey =
  | "OAuthAccountNotLinked"
  | "AccessDenied"
  | "EmailUnverified"
  | "SignedIn"
  | "OAuthCallbackError"
  | "Configuration"
  | "generic";

export function authErrorKey(raw: string | null | undefined): AuthErrorKey | null {
  if (!raw) return null;
  switch (raw) {
    case "OAuthAccountNotLinked":
    case "AccountNotLinked":
      return "OAuthAccountNotLinked";
    case "AccessDenied":
      return "AccessDenied";
    case "EmailUnverified":
      return "EmailUnverified";
    case "SignedIn":
      return "SignedIn";
    case "OAuthCallbackError":
    case "OAuthSignin":
    case "OAuthCallback":
      return "OAuthCallbackError";
    case "Configuration":
      return "Configuration";
    default:
      return "generic";
  }
}
