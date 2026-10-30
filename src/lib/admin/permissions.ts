import type { AdminRole } from "@prisma/client";

/**
 * Who may do what.
 *
 * Permissions are named after actions, not after screens. A screen can
 * be hidden and still be reachable by typing its URL; an action checked
 * on the server cannot. Every admin route checks a permission from this
 * list before it does anything, and the navigation is built by asking
 * the same questions — so what somebody can see and what they can do
 * cannot drift apart.
 *
 * The roles, in widening order:
 *
 *   MODERATOR    reported reviews, and nothing else
 *   ADMIN        the platform's content and the people on it
 *   SUPER_ADMIN  money, system settings, and granting roles
 *
 * A moderator cannot read payment data. That is the point of having
 * three roles rather than one flag: the person who looks at reported
 * reviews all day does not need to see what anybody paid.
 */

export const PERMISSIONS = [
  // Reviews and reports.
  "reviews.read",
  "reviews.moderate",

  // The businesses themselves.
  "businesses.read",
  "businesses.moderate", // approve, reject, suspend, feature
  "businesses.edit",
  "businesses.verify",

  // People and their bookings.
  "customers.read",
  "bookings.read",
  "bookings.manage",

  // The catalogue everything else hangs off.
  "catalogue.read", // categories, cities, services
  "catalogue.edit",

  // Destinations: organisations, compounds, venues, and who manages them.
  "venues.read",
  "venues.manage", // create, publish, suspend, grant venue roles

  // Money.
  "subscriptions.read",
  "subscriptions.manage",
  "payments.read",
  // Moving money back out. Separate from payments.read because
  // reading what somebody paid and sending it back to them are
  // not the same level of trust.
  "payments.refund",

  // Operational.
  "notifications.read",
  "reports.read",
  "audit.read",

  // The dangerous ones.
  "settings.manage",
  "roles.grant",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * What a moderator can do. Everything else builds on this, so a
 * permission added here is added to every role above it.
 */
const MODERATOR: Permission[] = ["reviews.read", "reviews.moderate"];

const ADMIN: Permission[] = [
  ...MODERATOR,
  "businesses.read",
  "businesses.moderate",
  "businesses.edit",
  "businesses.verify",
  "customers.read",
  "bookings.read",
  "bookings.manage",
  "catalogue.read",
  "catalogue.edit",
  "venues.read",
  "venues.manage",
  "notifications.read",
  "reports.read",
  "audit.read",
  // Deliberately absent: payments, subscriptions, settings, roles.
  // An administrator runs the platform; they do not need to read what
  // anybody paid, and they cannot make themselves a super admin.
];

const SUPER_ADMIN: Permission[] = [
  ...ADMIN,
  "subscriptions.read",
  "subscriptions.manage",
  "payments.read",
  "payments.refund",
  "settings.manage",
  "roles.grant",
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  MODERATOR,
  ADMIN,
  SUPER_ADMIN,
};

/**
 * The one question every guard asks.
 *
 * A null role is somebody who is not an administrator, which answers
 * false for everything — including permissions that do not exist, so a
 * typo in a route fails closed rather than open.
 */
export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const granted = ROLE_PERMISSIONS[role];
  if (!granted) return false;
  return granted.includes(permission);
}

/** True when the role may do any one of these. Used for nav sections. */
export function canAny(
  role: AdminRole | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((p) => can(role, p));
}

export const ROLE_LABELS: Record<AdminRole, { ar: string; en: string }> = {
  MODERATOR: { ar: "مراجع", en: "Moderator" },
  ADMIN: { ar: "مشرف", en: "Admin" },
  SUPER_ADMIN: { ar: "مشرف عام", en: "Super admin" },
};
