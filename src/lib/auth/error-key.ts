/**
 * Which explanation (t.auth.errors) fits NextAuth's ?error= value.
 *
 * Only the types NextAuth sends to a browser (@auth/core errors.js,
 * clientErrors, plus "Configuration" for everything it keeps to
 * itself). Anything else that turns up in the parameter gets the plain
 * "something went wrong", never the raw value: it is the address bar,
 * and anybody can write in it.
 */
export type AuthErrorKey = "OAuthAccountNotLinked" | "AccessDenied" | "OAuthCallbackError" | "Configuration" | "generic";

export function authErrorKey(raw: string | null | undefined): AuthErrorKey | null {
  if (!raw) return null;
  switch (raw) {
    case "OAuthAccountNotLinked":
    case "AccountNotLinked":
      return "OAuthAccountNotLinked";
    case "AccessDenied":
      return "AccessDenied";
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
