import { z } from "zod";
import { db } from "@/lib/db";
import { isOwnerPreview } from "@/lib/business/preview";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { toCents } from "@/lib/payments/money";
import { FAILURE_AR } from "@/lib/discounts/apply";
import { resolveAutomatic, resolveCode } from "@/lib/discounts/resolve";

type Params = { params: Promise<{ slug: string }> };

const schema = z.object({
  serviceId: z.string().min(1),
  code: z.string().trim().max(40).optional(),
});

/**
 * POST /api/public/[slug]/quote
 *
 * What this booking would cost, and whether a code works.
 *
 * Exists so the widget can show the reduced price before the customer
 * commits, without the widget being told how discounts work. It asks
 * the same functions the booking route asks, so the number quoted here
 * is the number charged there — a preview computed separately is a
 * preview that will eventually disagree.
 *
 * No customer is known at this point, so a per-customer limit cannot be
 * checked yet. The booking route checks it with the customer in hand
 * and may still refuse; the quote says what the offer is worth, not
 * that this person may have it.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("طلب غير صالح", 422);

    const found = await db.business.findUnique({
      where: { slug },
      select: { id: true, isPublished: true, ownerId: true },
    });
    // Unpublished: only for its owner's preview (lib/business/preview).
    const business = found && (found.isPublished || (await isOwnerPreview(found))) ? found : null;
    if (!business) return err("النشاط غير موجود", 404);

    const service = await db.service.findFirst({
      where: { id: parsed.data.serviceId, businessId: business.id, isAvailable: true },
      select: { id: true, price: true, currency: true },
    });
    if (!service) return err("الخدمة غير موجودة", 404);

    const subtotalCents = toCents(service.price);
    const code = parsed.data.code?.trim();

    const resolved = code
      ? await resolveCode({ businessId: business.id, serviceId: service.id, subtotalCents, code })
      : await resolveAutomatic({ businessId: business.id, serviceId: service.id, subtotalCents });

    if (code && resolved.ok === false) {
      return ok({
        subtotalCents,
        totalCents: subtotalCents,
        discount: null,
        currency: service.currency,
        codeError: resolved.reason === "not-found" ? "الكود ده مش موجود" : FAILURE_AR[resolved.reason],
      });
    }

    const applied = resolved.ok === true ? resolved.discount : null;

    return ok({
      subtotalCents,
      totalCents: applied ? applied.totalCents : subtotalCents,
      currency: service.currency,
      discount: applied
        ? {
            nameAr: applied.nameAr,
            code: applied.code,
            amountCents: applied.amountCents,
            /** True when nobody asked for it — the widget words it differently. */
            automatic: applied.code === null,
          }
        : null,
      codeError: null,
    });
  } catch (e) {
    log.error("[quote]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
