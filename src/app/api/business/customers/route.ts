import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { can, requireBusinessAccess } from "@/lib/business-access";
import { log } from "@/lib/logger";

export type CustomerRow = {
  id:              string;
  name:            string;
  phone:           string;
  email:           string | null;
  notes:           string | null;
  createdAt:       string;
  bookingCount:    number;
  /** Null for a manager: spend is the owner's to see. */
  totalSpend:      number | null;
  lastBookingDate: string | null;
  currency:        string;
};

/**
 * GET /api/business/customers
 *
 * Query params:
 *   search — name or phone (case-insensitive)
 *   sort   — name | bookingCount | lastVisit | totalSpend | createdAt (default: createdAt)
 *   order  — asc | desc (default: desc)
 */
export async function GET(req: Request) {
  try {
    const { business, actor } = await requireBusinessAccess("customers.read");
    // Spend is money, and money is the owner's: managers get the customer
    // book without it.
    const seeMoney = can(actor, "reports.read");
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() ?? "";
    const sort   = searchParams.get("sort")   ?? "createdAt";
    const order  = searchParams.get("order")  ?? "desc";

    const raw = await db.customer.findMany({
      where: {
        businessId: business.id,
        ...(search
          ? {
              OR: [
                { name:  { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        bookings: {
          select: { totalPrice: true, date: true, status: true, currency: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute aggregates per customer
    const rows: CustomerRow[] = raw.map((c) => {
      const active    = c.bookings.filter((b) => b.status !== "CANCELLED");
      const revenue   = c.bookings
        .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
        .reduce((sum, b) => sum + Number(b.totalPrice), 0);
      const sorted    = [...active].sort((a, b) => b.date.getTime() - a.date.getTime());
      const lastDate  = sorted[0]?.date.toISOString().split("T")[0] ?? null;
      const currency  = c.bookings[0]?.currency ?? "EGP";

      return {
        id:              c.id,
        name:            c.name,
        phone:           c.phone,
        email:           c.email,
        notes:           c.notes,
        createdAt:       c.createdAt.toISOString(),
        bookingCount:    active.length,
        totalSpend:      seeMoney ? revenue : null,
        lastBookingDate: lastDate,
        currency,
      };
    });

    // Sort in JS (aggregates can't be sorted in Prisma directly)
    const dir = order === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      switch (sort) {
        case "name":         return dir * a.name.localeCompare(b.name, "ar");
        case "bookingCount": return dir * (a.bookingCount - b.bookingCount);
        case "totalSpend":   return dir * ((a.totalSpend ?? 0) - (b.totalSpend ?? 0));
        case "lastVisit": {
          const da = a.lastBookingDate ?? "0000-00-00";
          const db = b.lastBookingDate ?? "0000-00-00";
          return dir * da.localeCompare(db);
        }
        default: // createdAt
          return dir * a.createdAt.localeCompare(b.createdAt);
      }
    });

    return ok({ customers: rows, total: rows.length });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[customers GET]", e);
    return err("حدث خطأ", 500);
  }
}
