import { z } from "zod";
import { NextResponse } from "next/server";
import { err, requireSession } from "@/lib/api";
import { recordAudit } from "@/lib/admin/audit";
import { ACTING_COOKIE, resolveDelegation } from "@/lib/organizations/delegation";
import { orgHandle, readJson } from "@/lib/organizations/route";

const schema = z.object({ businessId: z.string().min(1).max(40) });

const COOKIE = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  // A working session, not a standing grant: the delegation itself is
  // re-read on every request regardless.
  maxAge: 8 * 60 * 60,
};

/**
 * POST /api/organizations/acting — start operating a business for an
 * organization. Refused (404, saying nothing about the business) unless
 * the business granted this person's organization at least one scope on
 * a live relationship. The cookie only names the business: every later
 * request decides again, from the database, what it may do.
 *
 * DELETE /api/organizations/acting — stop, back to one's own account.
 */
export async function POST(req: Request) {
  return orgHandle("acting POST", async () => {
    const session = await requireSession();
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err("بيانات غير صالحة", 422);
    const delegation = await resolveDelegation(session.user.id, parsed.data.businessId);
    if (!delegation) return err("مش متاح", 404);

    for (const via of delegation.via) {
      await recordAudit({
        actor: null,
        action: "org.operate.start",
        resourceType: "Organization",
        resourceId: via.organizationId,
        summary: `بدأ إدارة نشاط مفوّض (${via.relation})`,
        metadata: { byUserId: session.user.id, businessId: parsed.data.businessId, associationId: via.associationId, scopes: via.scopes },
      });
    }
    const res = NextResponse.json({ acting: true, scopes: delegation.scopes });
    res.cookies.set(ACTING_COOKIE, parsed.data.businessId, COOKIE);
    return res;
  });
}

export async function DELETE() {
  return orgHandle("acting DELETE", async () => {
    await requireSession();
    const res = NextResponse.json({ acting: false });
    res.cookies.set(ACTING_COOKIE, "", { ...COOKIE, maxAge: 0 });
    return res;
  });
}
