import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { venueCan } from "@/lib/venues/access";
import { handle, readJson, venueAudit } from "@/lib/venues/route";
import { venueAccessChanged, venueDesk } from "@/lib/access/venue-desk";
import { providerUsable, sandboxAllowed } from "@/lib/access/provider";
import { ensureSandboxProvider } from "@/lib/access/sandbox";

type Ctx = { params: Promise<{ id: string }> };

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

/**
 * GET /api/venues/:id/access[?day=YYYY-MM-DD] — the security desk: the
 * day's visitor passes, recent gate events, what needs a person, and the
 * venue's access settings (lib/access/venue-desk.ts — names and windows,
 * never what was booked or paid). Needs venue.access.view.
 *
 * PUT /api/venues/:id/access
 *   { accessEnabled }              venue.access.enable (operators)
 *   { providerSlug, siteRef }      venue.access.provider (platform only)
 *
 * Switching passes on needs a provider that can be used here; switching
 * them off holds every live pass (SUSPENDED), it does not end them.
 */
export async function GET(req: Request, { params }: Ctx) {
  return handle("venue access GET", async () => {
    const { id } = await params;
    const { authority } = await requireVenueAccess(id, "venue.access.view");
    const parsedDay = day.safeParse(new URL(req.url).searchParams.get("day") ?? undefined);
    if (!parsedDay.success) return err("تاريخ غير صحيح", 422);
    const desk = await venueDesk(id, parsedDay.data);
    if (!desk) return err("غير موجود", 404);
    const providers = venueCan(authority, "venue.access.provider")
      ? (await listProviders()).map((p) => ({ slug: p.slug, kind: p.kind, name: p.nameAr, usable: providerUsable(p) }))
      : [];
    return ok({
      ...desk,
      providers,
      authority,
      can: {
        override: venueCan(authority, "venue.access.override"),
        enable: venueCan(authority, "venue.access.enable"),
        provider: venueCan(authority, "venue.access.provider"),
      },
    });
  });
}

async function listProviders() {
  if (sandboxAllowed()) await ensureSandboxProvider();
  return db.accessProvider.findMany({ where: { isEnabled: true }, orderBy: { createdAt: "asc" } });
}

const putSchema = z
  .object({
    accessEnabled: z.boolean().optional(),
    providerSlug: z.string().max(60).nullable().optional(),
    siteRef: z.string().trim().max(120).nullable().optional(),
  })
  .refine((v) => v.accessEnabled !== undefined || v.providerSlug !== undefined || v.siteRef !== undefined, { message: "مفيش تغيير" });

export async function PUT(req: Request, { params }: Ctx) {
  return handle("venue access PUT", async () => {
    const { id } = await params;
    const parsed = putSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const body = parsed.data;
    const needsProvider = body.providerSlug !== undefined || body.siteRef !== undefined;
    const { caller, authority } = await requireVenueAccess(id, needsProvider ? "venue.access.provider" : "venue.access.enable");
    if (body.accessEnabled !== undefined && !venueCan(authority, "venue.access.enable")) return err("غير موجود", 404);

    const current = await db.venue.findUniqueOrThrow({ where: { id }, select: { accessEnabled: true, accessProvider: true, accessSiteRef: true } });
    let provider = current.accessProvider;
    if (body.providerSlug !== undefined) {
      provider = body.providerSlug ? await db.accessProvider.findUnique({ where: { slug: body.providerSlug } }) : null;
      if (body.providerSlug && !provider) return err("مزوّد غير موجود", 422, { code: "unknown-provider" });
      if (provider && !providerUsable(provider)) return err("المزوّد ده مش متاح هنا", 422, { code: "provider-unusable" });
    }
    const enabled = body.accessEnabled ?? (provider ? current.accessEnabled : false);
    if (enabled && (!provider || !providerUsable(provider))) {
      return err("لازم مزوّد دخول متاح قبل تشغيل تصاريح الزوار", 409, { code: "no-provider" });
    }

    await db.venue.update({
      where: { id },
      data: {
        accessEnabled: enabled,
        ...(body.providerSlug !== undefined ? { accessProviderId: provider?.id ?? null } : {}),
        ...(body.siteRef !== undefined ? { accessSiteRef: body.siteRef || null } : {}),
      },
    });
    await venueAudit(caller, authority, "venue.access", id, enabled ? "شغّل تصاريح دخول الزوار" : "وقّف تصاريح دخول الزوار", {
      accessEnabled: enabled,
      provider: provider?.slug ?? null,
      siteRefChanged: body.siteRef !== undefined,
    });
    venueAccessChanged(id);
    return ok({ accessEnabled: enabled, provider: provider?.slug ?? null });
  });
}
