import { db } from "@/lib/db";
import { isOwnerPreview } from "@/lib/business/preview";
import { ok, err } from "@/lib/api";
import { loadAvailability } from "@/lib/bookings/schedule";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/public/[slug]/slots?serviceId=&date=YYYY-MM-DD
 *
 * The times a customer may pick. Optional staffMemberId, resourceId and
 * branchId narrow it to one resource.
 *
 * This endpoint and the one that creates a booking both call
 * loadAvailability, so what is offered here is exactly what the server
 * will accept — and a slot that goes stale between the two is caught
 * there rather than becoming a double booking.
 *
 * Public, read-only, no auth.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);

    const serviceId = searchParams.get("serviceId");
    const date = searchParams.get("date");

    if (!serviceId || !date) return err("اختار الخدمة واليوم", 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err("تاريخ غير صحيح", 400);

    const found = await db.business.findUnique({
      where: { slug },
      select: { id: true, isPublished: true, ownerId: true },
    });
    // Unpublished: only for its owner's preview (lib/business/preview).
    const business = found && (found.isPublished || (await isOwnerPreview(found))) ? found : null;
    if (!business) return err("لم يتم العثور على هذا العمل", 404);

    // How many are coming, so a table is only offered when it seats them
    // — and, with no table named, so one that fits is chosen.
    const partyRaw = searchParams.get("partySize");
    const partySize = partyRaw && /^\d{1,3}$/.test(partyRaw) ? Number(partyRaw) : null;

    const { slots, reason } = await loadAvailability({
      businessId: business.id,
      serviceId,
      date,
      staffMemberId: searchParams.get("staffMemberId"),
      resourceId: searchParams.get("resourceId"),
      branchId: searchParams.get("branchId"),
      partySize,
    });

    // `reason` says why a day is empty — closed, a holiday, past the
    // cutoff — so the UI can explain instead of showing a blank grid.
    return ok({ slots, reason });
  } catch (e) {
    log.error("[slots GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
