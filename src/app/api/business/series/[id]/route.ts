import { ok, err } from "@/lib/api";
import { db } from "@/lib/db";
import { requireBusinessAccess } from "@/lib/business-access";
import { businessHandle } from "@/lib/business/route";
import { cancelSeries } from "@/lib/bookings/series";

/** DELETE /api/business/series/:id — ends a series; its upcoming occurrences are cancelled. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return businessHandle("series DELETE", async () => {
    const { session, business, actor } = await requireBusinessAccess("bookings.cancel");
    const { id } = await params;
    // A delegation limited to some branches may end only a series that
    // lives entirely in them (final audit F-26): otherwise it could cancel
    // another branch's recurring bookings by id.
    const branchIds = actor.role === "DELEGATE" ? actor.delegation?.branchIds : null;
    if (branchIds) {
      const outside = await db.booking.count({
        where: { seriesId: id, businessId: business.id, OR: [{ branchId: null }, { branchId: { notIn: branchIds } }] },
      });
      const inside = await db.booking.count({ where: { seriesId: id, businessId: business.id, branchId: { in: branchIds } } });
      if (outside > 0 || inside === 0) return err("غير موجود", 404);
    }
    const r = await cancelSeries(business.id, id, session.user.id);
    if (!r) return err("غير موجود", 404);
    return ok(r);
  });
}
