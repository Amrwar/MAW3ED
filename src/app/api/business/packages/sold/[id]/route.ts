import { z } from "zod";
import { ok, err, requireBusiness } from "@/lib/api";
import { businessHandle, readJson } from "@/lib/business/route";
import {
  cancelMembership, cancelPackage, pauseMembership, refundAtDesk, renewMembership, resumeMembership,
} from "@/lib/entitlements/ledger";

/**
 * POST /api/business/packages/sold/:id — what the desk does to a package
 * or membership already sold: cancel, refund (money handed back in
 * person; refused while upcoming bookings still hold its sessions), and
 * for a membership renew, pause and resume.
 */
const body = z.discriminatedUnion("action", [
  z.object({ kind: z.enum(["package", "membership"]), action: z.literal("cancel"), when: z.enum(["now", "period-end"]).optional() }),
  z.object({
    kind: z.enum(["package", "membership"]), action: z.literal("refund"),
    amountCents: z.number().int().min(1).max(100_000_000), reason: z.string().trim().min(3).max(500),
  }),
  z.object({ kind: z.literal("membership"), action: z.literal("renew"), method: z.enum(["CASH", "CARD", "WALLET", "OTHER"]) }),
  z.object({ kind: z.literal("membership"), action: z.literal("pause") }),
  z.object({ kind: z.literal("membership"), action: z.literal("resume") }),
]);

const WHY: Record<string, string> = {
  "not-found": "غير موجود",
  "wrong-status": "مينفعش في حالتها دي",
  "paid-ahead": "مدفوعة لفترة قدّام بالفعل",
  "no-pause-left": "خلص رصيد الإيقاف (60 يوم)",
  "too-much": "المبلغ أكبر من المدفوع",
  "live-bookings": "فيه حجوزات جاية بتستخدمها — ألغيها الأول",
  "nothing-paid": "مفيش دفعة نقدية مسجلة ليها",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return businessHandle("entitlement action", async () => {
    const { session, business } = await requireBusiness();
    const { id } = await params;
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const a = parsed.data;
    let r: { ok: boolean; why?: string };
    switch (a.action) {
      case "cancel":
        r = a.kind === "package"
          ? (await cancelPackage(business.id, id)) ? { ok: true } : { ok: false, why: "wrong-status" }
          : await cancelMembership(business.id, id, a.when ?? "period-end");
        break;
      case "refund":
        r = await refundAtDesk({
          businessId: business.id,
          target: a.kind === "package" ? { packageId: id } : { membershipId: id },
          amountCents: a.amountCents,
          reason: a.reason,
          actorId: session.user.id,
          actorName: typeof session.user.name === "string" && session.user.name ? session.user.name : business.nameAr,
        });
        break;
      case "renew":
        r = await renewMembership({ businessId: business.id, membershipId: id, method: a.method, recordedById: session.user.id });
        break;
      case "pause":
        r = await pauseMembership(business.id, id);
        break;
      case "resume":
        r = await resumeMembership(business.id, id);
        break;
    }
    if (!r.ok) return err(WHY[r.why ?? ""] ?? "مينفعش", r.why === "not-found" ? 404 : 409, { code: r.why });
    return ok({ ok: true });
  });
}
