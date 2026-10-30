import { normalisePhone } from "@/lib/phone";
import { db } from "@/lib/db";
import { pseudonym } from "@/lib/security/pseudonym";
import {
  PHONE_CODE_TTL_MS,
  PHONE_MAX_ATTEMPTS,
  PHONE_RESEND_COOLDOWN_MS,
  cooledDown,
  generatePhoneCode,
  hashSecret,
  isExpired,
  secretMatches,
} from "@/lib/verification";

/**
 * Signing a customer in with a code sent to their phone.
 *
 * The phone is the point. Bookings are keyed by it, so proving control
 * of the number is what makes somebody's history theirs — there is no
 * claiming step to get wrong and no way to adopt a stranger's
 * appointments by typing their number.
 *
 * Rules this enforces, all of them because the endpoint is open to
 * anyone:
 *
 *   - one live code per number, so an attacker cannot keep several in
 *     flight and try them in parallel;
 *   - a cooldown between sends, so the endpoint cannot be used to
 *     bombard somebody with WhatsApp messages from our sender;
 *   - a hard ceiling on guesses, after which the code is burned rather
 *     than merely rejected;
 *   - only the hash is stored, so a read of the table proves nothing.
 */

/** How many sends one number may ask for in an hour. */
const MAX_SENDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

export type SendResult =
  | { ok: true; phone: string; code: string }
  | { ok: false; reason: "invalid-phone" | "cooldown" | "too-many" };

export async function createLoginCode(rawPhone: string): Promise<SendResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, reason: "invalid-phone" };

  const since = new Date(Date.now() - HOUR_MS);

  const [recent, sentThisHour] = await Promise.all([
    db.loginCode.findFirst({
      where: { phone },
      orderBy: { lastSentAt: "desc" },
      select: { lastSentAt: true },
    }),
    db.loginCode.count({ where: { phone, createdAt: { gte: since } } }),
  ]);

  if (recent && !cooledDown(recent.lastSentAt, PHONE_RESEND_COOLDOWN_MS)) {
    return { ok: false, reason: "cooldown" };
  }
  if (sentThisHour >= MAX_SENDS_PER_HOUR) {
    return { ok: false, reason: "too-many" };
  }

  const code = generatePhoneCode();

  // One live code per number: the previous one stops working the
  // moment a new one is asked for.
  await db.$transaction([
    db.loginCode.deleteMany({ where: { phone, expiresAt: { gt: new Date() } } }),
    db.loginCode.create({
      data: {
        phone,
        codeHash: hashSecret(code),
        expiresAt: new Date(Date.now() + PHONE_CODE_TTL_MS),
      },
    }),
  ]);

  return { ok: true, phone, code };
}

export type VerifyResult =
  | { ok: true; phone: string }
  | { ok: false; reason: "invalid-phone" | "no-code" | "expired" | "too-many-attempts" | "wrong" };

/**
 * Checks a code and consumes it.
 *
 * A correct code is deleted immediately so it cannot be replayed, and
 * an exhausted one is deleted too — leaving a burned code in the table
 * would let somebody keep guessing against it forever.
 */
export async function verifyLoginCode(rawPhone: string, candidate: string): Promise<VerifyResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) return { ok: false, reason: "invalid-phone" };

  const record = await db.loginCode.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { ok: false, reason: "no-code" };

  if (isExpired(record.expiresAt)) {
    await db.loginCode.deleteMany({ where: { id: record.id } });
    return { ok: false, reason: "expired" };
  }

  // Spend the attempt BEFORE comparing, in one conditional statement.
  // Reading `attempts` and writing it back afterwards let parallel
  // guesses all see the same count and all get compared, so firing a
  // few hundred at once walked straight past the ceiling. The database
  // evaluates `attempts < MAX` and the increment together, so of any
  // number of concurrent guesses at most MAX ever reach the comparison.
  const claimed = await db.loginCode.updateMany({
    where: { id: record.id, attempts: { lt: PHONE_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    await db.loginCode.deleteMany({ where: { id: record.id } });
    return { ok: false, reason: "too-many-attempts" };
  }

  if (!secretMatches(candidate.trim(), record.codeHash)) {
    // Burn it once the last attempt is spent. Conditional on the stored
    // count rather than on our own arithmetic, which another request
    // may already have overtaken.
    await db.loginCode.deleteMany({
      where: { id: record.id, attempts: { gte: PHONE_MAX_ATTEMPTS } },
    });
    return { ok: false, reason: "wrong" };
  }

  // Only the request that actually removes the row wins: two copies of
  // the right code sent at once must not both sign somebody in.
  const consumed = await db.loginCode.deleteMany({ where: { id: record.id } });
  if (consumed.count === 0) return { ok: false, reason: "no-code" };

  return { ok: true, phone };
}

/**
 * Finds or creates the account for a phone that has just been proved.
 *
 * The name is lifted from whatever they last booked under, so a first
 * sign-in does not greet them as nobody. Nothing else about the
 * bookings changes — they were already theirs; the account only makes
 * them reachable.
 */
export async function accountForVerifiedPhone(phone: string): Promise<{ id: string }> {
  const existing = await db.user.findUnique({ where: { phone }, select: { id: true } });
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { phoneVerifiedAt: new Date() } });
    return existing;
  }

  // A number a deleted account released starts afresh: nothing from
  // before the release — not the name, not the bookings — is this
  // person's to see (lib/account/deletion.ts).
  const release = await db.phoneRelease.findUnique({
    where: { phoneHash: pseudonym(phone) },
    select: { releasedAt: true },
  });

  const lastBooking = await db.booking.findFirst({
    // By the canonical column, not the one the customer typed into:
    // "01107578212" and "201107578212" are the same number, and only
    // the generated column knows that.
    // An owner's test booking is not this person's name.
    where: { customerPhoneE164: phone, isTest: false, ...(release ? { createdAt: { gte: release.releasedAt } } : {}) },
    orderBy: { createdAt: "desc" },
    select: { customerName: true },
  });

  return db.user.create({
    data: {
      phone,
      phoneVerifiedAt: new Date(),
      name: lastBooking?.customerName ?? null,
      historySince: release?.releasedAt ?? null,
    },
    select: { id: true },
  });
}
