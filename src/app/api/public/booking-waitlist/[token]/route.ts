import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { acceptOffer, leaveWaitlist } from "@/lib/bookings/slot-waitlist";
import { callerKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * The customer's own waitlist link (the token is the secret, like a
 * booking's access token): GET what it stands at, POST to take the time
 * on offer, DELETE to leave. Nothing about anyone else on the list.
 */
type P = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: P) {
  try {
    const { token } = await params;
    const e = await db.slotWaitlistEntry.findUnique({
      where: { manageToken: token },
      select: {
        status: true, date: true, fromTime: true, toTime: true, offeredTime: true, offerToken: true,
        offerExpiresAt: true, offers: true, customerName: true,
        business: { select: { nameAr: true, nameEn: true, slug: true } },
        booking: { select: { accessToken: true } },
      },
    });
    if (!e) return err("الرابط غير صحيح", 404, { code: "not-found" });
    const live = e.status === "OFFERED" && !!e.offerExpiresAt && e.offerExpiresAt > new Date();
    return ok({
      status: live || e.status !== "OFFERED" ? e.status : "WAITING",
      date: e.date.toISOString().slice(0, 10),
      fromTime: e.fromTime,
      toTime: e.toTime,
      offer: live ? { time: e.offeredTime, token: e.offerToken, expiresAt: e.offerExpiresAt } : null,
      business: e.business,
      bookingToken: e.booking?.accessToken ?? null,
    });
  } catch (e) {
    log.error("[waitlist entry GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

const accept = z.object({ offerToken: z.string().min(10).max(100) });

export async function POST(req: Request, { params }: P) {
  try {
    const { token } = await params;
    const limited = await rateLimit("publicBooking", `${await callerKey()}|wait-accept`);
    if (!limited.ok) return tooManyRequests(limited);
    const parsed = accept.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("طلب غير صحيح", 422, { code: "invalid" });
    const r = await acceptOffer(token, parsed.data.offerToken);
    if (!r.ok) {
      const map = {
        "not-found": ["الرابط غير صحيح", 404],
        expired: ["العرض انتهى — هنبعتلك لو فضي ميعاد تاني", 410],
        taken: ["للأسف حد حجز الميعاد ده قبلك — لسه في قائمة الانتظار", 409],
        "call-business": ["كلّم المكان عشان تحجز", 403],
      } as const;
      const [m, s] = map[r.why];
      return err(m, s, { code: r.why });
    }
    return ok({ bookingUrl: `/booking/${r.accessToken}`, reference: r.reference }, 201);
  } catch (e) {
    log.error("[waitlist accept]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function DELETE(_req: Request, { params }: P) {
  try {
    const { token } = await params;
    const limited = await rateLimit("publicBooking", `${await callerKey()}|wait-leave`);
    if (!limited.ok) return tooManyRequests(limited);
    await leaveWaitlist(token);
    return ok({ ok: true });
  } catch (e) {
    log.error("[waitlist leave]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
