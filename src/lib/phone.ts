/**
 * Phone numbers, from anywhere.
 *
 * One canonical form for the whole product: E.164 digits with no plus —
 * country code then number, "201012345678", "966501234567",
 * "14155552671". It is what User.phone, LoginCode, PhoneVerification and
 * the Booking.customerPhoneE164 generated column hold, so a number typed
 * three different ways is still one person.
 *
 * Deliberately no per-country rulebook. Whether a number is real is
 * proved by the code sent to it: a mistyped number never receives one.
 * What this decides is only the shape, so that the same digits always
 * normalise the same way:
 *
 *  - Egyptian numbers keep every form they had — 010…, 10…, 2010…,
 *    +2010…, 0020… — and must still be mobiles (1 then 0, 1, 2 or 5,
 *    then eight digits), so every existing account and booking keeps
 *    matching.
 *  - Anything else must carry its country code: "+…", "00…", or 11+
 *    digits that do not start with 0. Between 8 and 15 digits, as E.164
 *    allows.
 *
 * prisma/migrations/international_phone.sql expresses exactly these rules
 * in SQL for the generated column; src/lib/phone.test.ts holds both to
 * the same cases. Change one, change the other.
 */

const EGYPT = "20";

/** What every form says when normalisePhone() cannot read a number. */
export const PHONE_INVALID = "رقم الموبايل غير صحيح — اكتبه بكود الدولة، مثلاً ‎+20 10 1234 5678";
const EGYPT_MOBILE = /^1[0125]\d{8}$/;

export function normalisePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const international = /^(\+|00)/.test(trimmed);
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);

  // Egypt, written locally: 01012345678 or 1012345678.
  if (!international) {
    if (/^0\d{10}$/.test(digits) && EGYPT_MOBILE.test(digits.slice(1))) return EGYPT + digits.slice(1);
    if (EGYPT_MOBILE.test(digits)) return EGYPT + digits;
  }

  // Egypt, with its country code — including the common "+20 010…".
  if (digits.startsWith(EGYPT)) {
    const rest = digits.slice(2);
    if (EGYPT_MOBILE.test(rest)) return digits;
    if (rest.startsWith("0") && EGYPT_MOBILE.test(rest.slice(1))) return EGYPT + rest.slice(1);
    return null;
  }

  // Everywhere else: a country code is required, and E.164's length.
  if ((international || digits.length >= 11) && /^[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}

/** "+20 10 1234 5678" for Egypt; "+966501234567" elsewhere — no guessing at another country's grouping. */
export function formatPhone(canonical: string | null | undefined): string {
  if (!canonical) return "";
  if (canonical.startsWith(EGYPT) && canonical.length === 12) {
    const l = canonical.slice(2);
    return `+20 ${l.slice(0, 2)} ${l.slice(2, 6)} ${l.slice(6)}`;
  }
  return `+${canonical}`;
}

/** The plus form, for APIs that want it (schema.org, tel: links). */
export function e164(canonical: string): string {
  return `+${canonical}`;
}

/**
 * A number to send to or link to — a WhatsApp message, a wa.me link, a
 * schema.org telephone — as canonical digits, or null.
 *
 * Looser than normalisePhone, on purpose: that one decides who may sign
 * in, so it wants a mobile; this one reaches a business's contact
 * number, which may be a landline (a clinic's WhatsApp Business line).
 * It tries the strict rules first, then reads a local-format number —
 * no country code, leading 0 — as Egyptian, the product's home market,
 * which is how every such number in the data was entered. It never
 * prepends a country code to a number that already carries one: the old
 * WhatsApp sender turned a US number, +1 415…, into 201415….
 */
export function dialable(raw: string | null | undefined, homeCountry = EGYPT): string | null {
  const strict = normalisePhone(raw);
  if (strict) return strict;
  if (!raw) return null;
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);

  if (/^(\+|00)/.test(trimmed)) return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
  // A local number: trunk 0, then the subscriber number.
  if (/^0[1-9]\d{6,11}$/.test(digits)) return homeCountry + digits.slice(1);
  // Already in international form without the plus.
  if (digits.startsWith(homeCountry) && /^[1-9]\d{9,14}$/.test(digits)) return digits;
  return null;
}
