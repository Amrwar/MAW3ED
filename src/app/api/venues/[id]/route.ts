import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { venueInfoSchema, venueHoursSchema } from "@/lib/venues/rules";
import { handle, readJson, venueAudit } from "@/lib/venues/route";
import { canEditCompoundGates, venueCan } from "@/lib/venues/access";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET   /api/venues/:id — everything the venue console shows.
 * PATCH /api/venues/:id — { info?, hours? } the venue's own details.
 *
 * Status and publishing are not here: putting a venue in front of the
 * public is a platform decision (/api/admin/venues/:id).
 */
export async function GET(_req: Request, { params }: Ctx) {
  return handle("venue GET", async () => {
    const { id } = await params;
    const { caller, authority } = await requireVenueAccess(id, "venue.view");
    const v = await db.venue.findUniqueOrThrow({
      where: { id },
      include: {
        city: { select: { id: true, nameAr: true, nameEn: true } },
        neighborhood: { select: { id: true, nameAr: true, nameEn: true } },
        compound: { select: { id: true, nameAr: true, nameEn: true, organizationId: true } },
        organization: { select: { id: true, nameAr: true, nameEn: true } },
        zones: { orderBy: [{ sortOrder: "asc" }, { level: "asc" }] },
        gates: { orderBy: { createdAt: "asc" } },
        hours: { orderBy: { dayOfWeek: "asc" } },
        policy: true,
        exceptions: { orderBy: { startsOn: "desc" }, take: 50 },
      },
    });
    const compoundGates = v.compoundId
      ? await db.venueGate.findMany({ where: { compoundId: v.compoundId }, orderBy: { createdAt: "asc" } })
      : [];
    return ok({
      venue: v,
      compoundGates,
      authority,
      can: {
        editInfo: venueCan(authority, "venue.editInfo"),
        decide: venueCan(authority, "venue.memberships.decide"),
        publish: venueCan(authority, "venue.publish"),
        compoundGates: !!v.compound && canEditCompoundGates(caller, v.compound),
      },
    });
  });
}

const patchSchema = z.object({ info: venueInfoSchema.optional(), hours: venueHoursSchema.optional() });

export async function PATCH(req: Request, { params }: Ctx) {
  return handle("venue PATCH", async () => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const { info, hours } = parsed.data;

    if (info) {
      const { caller, authority } = await requireVenueAccess(id, "venue.editInfo");
      await db.venue.update({ where: { id }, data: info });
      await venueAudit(caller, authority, "venue.edit", id, "عدّل بيانات المكان", { fields: Object.keys(info) });
    }
    if (hours) {
      const { caller, authority } = await requireVenueAccess(id, "venue.hours");
      await db.$transaction(
        hours.map((h) =>
          db.venueHours.upsert({
            where: { venueId_dayOfWeek: { venueId: id, dayOfWeek: h.dayOfWeek } },
            create: { ...h, venueId: id },
            update: { openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed },
          }),
        ),
      );
      await venueAudit(caller, authority, "venue.hours", id, "عدّل مواعيد المكان");
    }
    if (!info && !hours) return err("مفيش حاجة تتغير", 422);
    return ok({ saved: true });
  });
}
