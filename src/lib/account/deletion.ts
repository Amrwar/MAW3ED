import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Deleting a customer's account.
 *
 * What goes, and what stays, decided once here so the app and the
 * website cannot disagree about it:
 *
 *   Goes — the account itself and everything only it can see: saved
 *   places, the in-app notification feed, every app session and push
 *   token, sign-in links and codes still outstanding for its phone or
 *   email. Foreign keys cascade from User for most of it; the codes are
 *   keyed by phone or email rather than by user, so they are deleted
 *   explicitly — a sign-in code left behind for a deleted account would
 *   recreate the account the moment somebody used it.
 *
 *   Stays — the bookings, and the reviews and payments attached to them.
 *   Those are the businesses' records of appointments that happened (and
 *   the payment ledger is a financial record that must not be edited).
 *   They were never joined to the account by a key: a booking records
 *   the phone it was made under. Once the account is gone, nothing links
 *   them to any login.
 *
 * Owners and administrators are refused. Deleting a User that owns a
 * Business would take the business — every customer's appointment with
 * it — down too; that is a separate, deliberate process with support.
 */

export type DeletionRefusal = "not-found" | "owns-business" | "admin";

export type DeletionResult = { ok: true } | { ok: false; reason: DeletionRefusal };

export async function deletionBlocker(userId: string): Promise<DeletionRefusal | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { adminRole: true, isAdmin: true, business: { select: { id: true } } },
  });
  if (!user) return "not-found";
  if (user.business) return "owns-business";
  if (user.adminRole || user.isAdmin) return "admin";
  return null;
}

export async function deleteCustomerAccount(userId: string): Promise<DeletionResult> {
  const blocker = await deletionBlocker(userId);
  if (blocker) return { ok: false, reason: blocker };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phone: true, email: true },
  });
  if (!user) return { ok: false, reason: "not-found" };

  await db.$transaction(async (tx) => {
    // Keyed by address, not by user: nothing cascades to these.
    if (user.phone) await tx.loginCode.deleteMany({ where: { phone: user.phone } });
    if (user.email) await tx.passwordResetToken.deleteMany({ where: { email: user.email } });

    // Cascades: Account, Session, EmailVerificationToken, Favorite,
    // Notification, MobileSession, DeviceToken. Payment.recordedBy and
    // Refund.actor are SetNull — a customer has neither.
    await tx.user.delete({ where: { id: userId } });
  });

  log.info("account deleted", { userId });
  return { ok: true };
}
