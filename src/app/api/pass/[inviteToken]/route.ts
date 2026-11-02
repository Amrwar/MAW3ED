import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { guestPassView } from "@/lib/access/passes";
import { passQr } from "@/lib/access/customer";

type Params = { params: Promise<{ inviteToken: string }> };

/**
 * GET /api/pass/:inviteToken[?lang=en] — a guest's own visitor pass, from
 * the link the booking holder shared. Shows that guest's pass and the
 * venue's instructions; nothing about the booking, the business or the
 * other guests.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const limited = await rateLimit("accessView");
    if (!limited.ok) return tooManyRequests(limited);
    const { inviteToken } = await params;
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(inviteToken)) return err("الرابط غير صالح", 404, { code: "not-found" });
    const view = await guestPassView(inviteToken, new URL(req.url).searchParams.get("lang") === "en");
    if (!view) return err("الرابط غير صالح أو اتلغى", 404, { code: "not-found" });
    return ok({ ...view, pass: await passQr(view.pass) });
  } catch (e) {
    log.error("[guest pass GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
