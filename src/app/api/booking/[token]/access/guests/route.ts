import { ok } from "@/lib/api";
import { log } from "@/lib/logger";
import { addGuest } from "@/lib/access/passes";
import { visitorPhone, visitorSchema } from "@/lib/access/customer";
import { bookingForToken, failure, invalidPhone, invalidVisitor, limitWrites, refusal } from "@/lib/access/customer-routes";
import { isEnglish } from "@/lib/lang";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/booking/:token/access/guests { displayName, phone? }
 *
 * Adds a named guest, within the venue's guest limit. The guest gets
 * their own link (inviteToken) to their own pass, which the holder
 * shares; Maw3ed sends nothing to a number nobody has verified.
 */
export async function POST(req: Request, { params }: Params) {
  const en = isEnglish(req);
  try {
    const { token } = await params;
    const booking = await bookingForToken(token, en);
    await limitWrites(booking.id);
    const parsed = visitorSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return invalidVisitor(parsed.error.issues[0], en);
    const phone = visitorPhone(parsed.data.phone);
    if (phone === "invalid") return invalidPhone(en);
    const r = await addGuest(booking.id, { displayName: parsed.data.displayName, phoneE164: phone });
    if (!r.ok) return refusal(r, en);
    return ok({ added: true, inviteToken: r.inviteToken }, 201);
  } catch (e) {
    return failure("[booking guest add]", e, log, en);
  }
}
