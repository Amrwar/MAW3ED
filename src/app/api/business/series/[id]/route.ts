import { ok, err } from "@/lib/api";
import { requireBusinessAccess } from "@/lib/business-access";
import { businessHandle } from "@/lib/business/route";
import { cancelSeries } from "@/lib/bookings/series";

/** DELETE /api/business/series/:id — ends a series; its upcoming occurrences are cancelled. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return businessHandle("series DELETE", async () => {
    const { session, business } = await requireBusinessAccess("bookings.cancel");
    const { id } = await params;
    const r = await cancelSeries(business.id, id, session.user.id);
    if (!r) return err("غير موجود", 404);
    return ok(r);
  });
}
