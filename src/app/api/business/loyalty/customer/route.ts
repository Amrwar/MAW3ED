import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { businessHandle, readJson } from "@/lib/business/route";
import { normalisePhone } from "@/lib/phone";
import { adjustPoints, programForBusiness, spendableAt } from "@/lib/loyalty/ledger";

/**
 * One customer's points at this business: GET ?phone= shows the balance
 * and the last entries; POST is the owner's correction, with a reason
 * (always recorded, with who made it). `key` comes from the form, so a
 * double-submitted correction is applied once.
 */

export async function GET(req: Request) {
  return businessHandle("loyalty customer GET", async () => {
    const { business } = await requireBusiness();
    const phone = normalisePhone(new URL(req.url).searchParams.get("phone") ?? "");
    if (!phone) return err("رقم الموبايل غير صحيح", 422, { code: "invalid" });
    const held = await spendableAt(business.id, phone);
    if (!held) return ok({ program: null });
    const account = await db.loyaltyAccount.findUnique({
      where: { programId_phoneE164: { programId: held.program.id, phoneE164: phone } },
      select: { id: true, lifetimeEarned: true },
    });
    const entries = account
      ? await db.loyaltyEntry.findMany({
          where: { accountId: account.id },
          orderBy: { createdAt: "desc" },
          take: 30,
          // Entries from other brands of an organization program show
          // as points only, never which business or booking.
          select: { id: true, kind: true, points: true, expiresAt: true, note: true, createdAt: true, businessId: true },
        })
      : [];
    return ok({
      program: { id: held.program.id, nameAr: held.program.nameAr },
      balance: held.balance,
      available: held.available,
      lifetimeEarned: account?.lifetimeEarned ?? 0,
      entries: entries.map((e) => ({
        id: e.id, kind: e.kind, points: e.points, expiresAt: e.expiresAt, createdAt: e.createdAt,
        note: e.businessId === business.id ? e.note : null,
        here: e.businessId === business.id,
      })),
    });
  });
}

const adjust = z.object({
  phone: z.string().min(5).max(40),
  points: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0, "اكتب عدد نقاط"),
  note: z.string().trim().min(3, "اكتب السبب").max(300),
  key: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  return businessHandle("loyalty adjust", async () => {
    const { session, business } = await requireBusiness();
    const parsed = adjust.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const phone = normalisePhone(parsed.data.phone);
    if (!phone) return err("رقم الموبايل غير صحيح", 422, { code: "invalid" });
    const program = await programForBusiness(business.id);
    // Only the business's own program can be corrected here; an
    // organization's points are the organization's ledger.
    if (!program || program.businessId !== business.id) {
      return err("التعديل اليدوي متاح لبرنامج النقاط الخاص بيك بس", 422, { code: "not-own-program" });
    }
    const r = await adjustPoints({
      programId: program.id,
      phoneE164: phone,
      points: parsed.data.points,
      note: parsed.data.note,
      actorUserId: session.user.id,
      key: `${business.id}:${parsed.data.key}`,
      businessId: business.id,
    });
    return ok({ applied: r.applied });
  });
}
