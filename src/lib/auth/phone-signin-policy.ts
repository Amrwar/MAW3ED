import { db } from "@/lib/db";

/**
 * Who may sign in with nothing but a code sent to their phone.
 *
 * A code by SMS or WhatsApp proves only that somebody holds the number
 * today. Numbers get recycled by carriers, lost to SIM swaps, and taken
 * over on WhatsApp; for a customer that exposes their own bookings, but
 * for a business owner it opens the dashboard (every customer's details,
 * payments, staff) and for an admin the whole platform. So an owner or
 * admin who has a stronger way in (a password, whose reset goes to their
 * email, or Google) must use it.
 *
 * An owner with no other way in keeps phone sign-in: onboarding only
 * asks for a session, so an account made by phone code can own a
 * business, and refusing it would lock that owner out for good. Closing
 * that is Phase 29 work (ask for a password or verified email before an
 * account can own a business); see docs/audits/POST_PHASE_28_PUBLIC_AUDIT.md.
 *
 * Staff who sign in by phone are unaffected: they hold no business of
 * their own (lib/business-access.ts), and the owner controls their seat.
 */
export interface PhoneSignInSubject {
  isAdmin:     boolean;
  adminRole:   string | null;
  /** The business this account owns, if any. */
  business:    { id: string } | null;
  hasPassword: boolean;
  /** Linked OAuth accounts (Google). */
  oauthCount:  number;
}

export function phoneSignInRefused(user: PhoneSignInSubject): boolean {
  const privileged = Boolean(user.business) || user.isAdmin || user.adminRole !== null;
  const hasOtherWayIn = user.hasPassword || user.oauthCount > 0;
  return privileged && hasOtherWayIn;
}

/**
 * The same decision for whoever holds `phone` now, read without writing
 * anything: called before accountForVerifiedPhone, which stamps
 * phoneVerifiedAt, so a refused attempt does not record the number as
 * freshly verified on the owner's account.
 */
export async function phoneSignInRefusedFor(phone: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where:  { phone },
    select: {
      isAdmin:   true,
      adminRole: true,
      password:  true,
      business:  { select: { id: true } },
      _count:    { select: { accounts: true } },
    },
  });
  if (!user) return false;
  return phoneSignInRefused({
    isAdmin:     user.isAdmin,
    adminRole:   user.adminRole,
    business:    user.business,
    hasPassword: Boolean(user.password),
    oauthCount:  user._count.accounts,
  });
}

export { USE_PASSWORD_CODE } from "./phone-signin-code";
