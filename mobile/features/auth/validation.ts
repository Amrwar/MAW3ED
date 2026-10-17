import { z } from "zod";

import { countryForDigits, type Country } from "./countries";

/**
 * What the sign-in fields accept before anything is sent.
 *
 * Only to keep a button disabled and say what is wrong without a round
 * trip. The server decides: it normalises the number itself
 * (normalisePhone in the web's src/lib/phone.ts) and its message is the
 * one shown when it refuses. The rules here are that function's, and
 * nothing beyond them: an Egyptian number must be a mobile — 1 then 0,
 * 1, 2 or 5, then eight digits — and any other is a country code and 8
 * to 15 digits in all, as E.164 allows. Whether the number is real is
 * proved by the code sent to it.
 */

const digits = (s: string) => s.replace(/\D/g, "");

/** Countries whose numbers keep their leading 0 after the calling code. */
const KEEPS_ZERO = new Set(["IT", "SM", "VA"]);

export interface PhoneInput {
  /** "+201012345678", ready to send — or null while it is not a number yet. */
  e164: string | null;
  /** The country the number belongs to: the picked one, or the one a pasted "+…" names. */
  country: Country;
}

/**
 * The number somebody typed, in the country they picked.
 *
 * The national form is what people know their number as — "010 1234
 * 5678", "050 123 4567" — so the trunk 0 is dropped before the calling
 * code goes on. A number pasted with its own code ("+966…", "00966…")
 * is taken as written, whatever country was picked.
 */
export function readPhone(raw: string, picked: Country): PhoneInput {
  const trimmed = raw.trim();
  let d = digits(trimmed);
  let country = picked;

  if (/^(\+|00)/.test(trimmed)) {
    if (trimmed.startsWith("00")) d = d.slice(2);
    const found = countryForDigits(d, picked);
    if (!found) return { e164: null, country: picked };
    country = found;
    d = d.slice(found.dial.length);
  } else if (d.startsWith(picked.dial) && d.length - picked.dial.length >= 8 && !d.startsWith("0")) {
    // Typed with the code but no plus: "201012345678" under Egypt.
    d = d.slice(picked.dial.length);
  }

  if (!KEEPS_ZERO.has(country.iso)) d = d.replace(/^0+/, "");
  const full = country.dial + d;

  const valid =
    country.iso === "EG" ? /^1[0125]\d{8}$/.test(d) : d.length >= 4 && /^[1-9]\d{7,14}$/.test(full);
  return { e164: valid ? `+${full}` : null, country };
}

// Only `.success` is read — the screens keep their button disabled until
// the input is valid rather than showing a message — so these carry no
// wording (which would otherwise need both languages).
export const loginCode = z
  .string()
  .transform(digits)
  .refine((d) => d.length === 6);

export const emailLogin = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/**
 * English for what POST /api/auth/phone/send can answer — the server
 * writes only Arabic (messageFor shows it as-is in Arabic mode).
 */
export const SEND_CODE_EN = {
  "422": "Enter a valid mobile number.",
  "429": "You've asked for too many codes. Wait a minute and try again.",
  "send-failed": "We couldn't send the code right now. Try again in a moment.",
};
