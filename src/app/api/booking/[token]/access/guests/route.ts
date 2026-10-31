import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { addGuest } from "@/lib/access/passes";
import { visitorPhone, visitorSchema } from "@/lib/access/customer";
import { bookingForToken, failure, limitWrites, refusal } from "@/lib/access/customer-routes";
import { PHONE_INVALID } from "@/lib/phone";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/booking/:token/access/guests { displayName, phone? }
 *
 * Adds a named guest, within the venue's guest limit. The guest gets
 * their own link (inviteToken) to their own pass, which the holder
 * shares; Maw3ed sends nothing to a number nobody has verified.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const booking = await bookingForToken(token);
    await limitWrites(booking.id);
    const parsed = visitorSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const phone = visitorPhone(parsed.data.phone);
    if (phone === "invalid") return err(PHONE_INVALID, 422, { code: "phone-invalid" });
    const r = await addGuest(booking.id, { displayName: parsed.data.displayName, phoneE164: phone });
    if (!r.ok) return refusal(r);
    return ok({ added: true, inviteToken: r.inviteToken }, 201);
  } catch (e) {
    return failure("[booking guest add]", e, log);
  }
}
