import { SignJWT, jwtVerify } from "jose";
import { signingSecret } from "@/lib/auth/signing-secret";

/**
 * Proof that whoever is booking controls the phone number on the booking.
 *
 * A guest booking used to need only a name and any number that parsed,
 * so a stranger's number — or a made-up one — could hold a slot and
 * send the owner an alert. With BOOKING_PHONE_VERIFICATION=1 a booking
 * from someone not signed in must carry one of these: a short-lived
 * token, issued once the customer has typed back the code sent to that
 * number (POST /api/public/phone-proof).
 *
 * A token rather than the code itself, because the code is single-use
 * and a booking can fail for reasons that are not the customer's — the
 * slot was taken a second earlier — and the retry must not cost a new
 * code. Thirty minutes covers a retry without making the token worth
 * stealing.
 *
 * Off by default: it only works where WhatsApp codes are delivered, and
 * turning it on before then would stop every guest from booking.
 */

const AUDIENCE = "maw3ed-booking-phone";
const ISSUER = "maw3ed";
const TTL_SECONDS = 30 * 60;

/** Whether guest bookings must prove their phone. */
export function phoneProofRequired(): boolean {
  return process.env.BOOKING_PHONE_VERIFICATION?.trim() === "1";
}

function secret(): Uint8Array {
  return signingSecret("booking phone proofs");
}

/** A proof for a canonical (normalisePhone) number. */
export async function issuePhoneProof(phoneE164: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(phoneE164)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
}

/** The canonical number a proof was issued for, or null if it is invalid or expired. */
export async function readPhoneProof(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
