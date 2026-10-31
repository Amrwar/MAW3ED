import type { Metadata } from "next";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import CheckInDesk from "@/components/access/CheckInDesk";

export const metadata: Metadata = { title: "تسجيل الوصول" };

/**
 * The front desk: scan a customer's booking QR and mark them arrived.
 * The same permission as marking arrived by hand (bookings.progress).
 * A booking QR is not a venue pass: venue gates are the venue's.
 */
export default async function CheckInPage() {
  await requireDashboardAccess("bookings.progress");
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">تسجيل الوصول</h1>
        <p className="text-sm text-[var(--color-muted)]">
          امسح كود الحجز اللي العميل بيعرضه. لو الكود مش بيتقري، دوّر على الحجز بالاسم في مواعيد النهارده وسجّل الوصول من هناك.
        </p>
      </header>
      <CheckInDesk />
    </div>
  );
}
