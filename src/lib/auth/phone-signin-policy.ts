/**
 * Who may sign in with nothing but a code sent to their phone.
 *
 * A code by SMS or WhatsApp proves only that somebody holds the number
 * today. Numbers get recycled by carriers, lost to SIM swaps, and taken
 * over on WhatsApp; for a customer that exposes their own bookings, but
 * for a business owner it opens the dashboard (every customer's details,
 * payments, staff) and for an admin the whole platform. Those accounts
 * sign in by password or Google, where a reset goes to their confirmed
 * email; a phone code is never enough on its own.
 *
 * Staff who sign in by phone are unaffected: they hold no business of
 * their own (lib/auth/business-access.ts), and the owner controls their
 * seat.
 */
export interface PhoneSignInSubject {
  isAdmin:    boolean;
  adminRole:  string | null;
  /** The business this account owns, if any. */
  business:   { id: string } | null;
}

export function phoneSignInRefused(user: PhoneSignInSubject): boolean {
  return Boolean(user.business) || user.isAdmin || user.adminRole !== null;
}

/** The code `signIn("phone-otp")` reports for a refused account. */
export const USE_PASSWORD_CODE = "use_password";
