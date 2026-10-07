/**
 * Who is signed in, and what that lets them see.
 *
 * The shape mirrors what POST /api/auth/mobile/login returns, which in
 * turn mirrors the session the web already builds — one definition of a
 * signed-in person across both clients.
 */

export type AdminRole = "MODERATOR" | "ADMIN" | "SUPER_ADMIN";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  /** The business this account owns, if it owns one. */
  businessId: string | null;
  adminRole: AdminRole | null;
}

/**
 * Which set of screens a person sees.
 *
 * Derived, never stored: the server decides what an account is by what
 * it returns, and a role kept in device storage is a role that can be
 * edited with a file browser. Recomputed on every load from the user
 * object the server last gave us.
 */
export type AppRole = "customer" | "business" | "admin";

/**
 * One person can be more than one thing — an owner who is also an
 * admin — so this returns every space they may enter, most privileged
 * first. The app opens in the first and lets them switch.
 */
export function rolesFor(user: AuthUser | null): AppRole[] {
  if (!user) return [];
  const roles: AppRole[] = [];
  if (user.adminRole) roles.push("admin");
  if (user.businessId) roles.push("business");
  // Everybody is a customer: an owner still books appointments.
  roles.push("customer");
  return roles;
}

export function primaryRole(user: AuthUser | null): AppRole {
  return rolesFor(user)[0] ?? "customer";
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}
