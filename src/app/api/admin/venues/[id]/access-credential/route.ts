import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { revokeVenueCredential, setVenueCredential } from "@/lib/access/venue-credentials";

/**
 * GET/POST /api/admin/venues/:id/access-credential — the venue's own
 * credential at its access provider (lib/access/venue-credentials).
 * Platform administrators only, like choosing the venue's provider. The
 * secret is write-only: it is never returned, only its version and dates.
 */
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set"), secret: z.string().min(16).max(2000).optional() }),
  z.object({ action: z.literal("revoke") }),
]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("admin venue credential GET", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const { id } = await params;
    const row = await db.venueAccessCredential.findUnique({
      where: { venueId: id },
      select: { providerId: true, keyVersion: true, rotatedAt: true, revokedAt: true, createdAt: true },
    });
    return ok({ credential: row });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("admin venue credential POST", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const { id } = await params;
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err("طلب غير صحيح", 422, { code: "invalid" });
    if (parsed.data.action === "revoke") {
      const done = await revokeVenueCredential(id);
      if (!done) return err("مفيش مفتاح ساري للمكان ده", 404, { code: "not-found" });
      await recordAudit({ actor, action: "venue.access_credential.revoke", resourceType: "Venue", resourceId: id, summary: "Venue access credential revoked" });
      return ok({ ok: true });
    }
    const r = await setVenueCredential(id, actor.id, parsed.data.secret);
    if (!r.ok) {
      const m = { "no-provider": ["اختار مزوّد البوابات للمكان الأول", 409], "no-key": ["مفتاح التشفير مش متظبط على السيرفر", 503], "not-found": ["المكان غير موجود", 404] } as const;
      const [msg, s] = m[r.why];
      return err(msg, s, { code: r.why });
    }
    await recordAudit({ actor, action: "venue.access_credential.set", resourceType: "Venue", resourceId: id, summary: `Venue access credential set (version ${r.keyVersion})`, metadata: { keyVersion: r.keyVersion } });
    return ok({ keyVersion: r.keyVersion });
  });
}
