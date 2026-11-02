import type { Metadata } from "next";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getLang } from "@/lib/lang-server";
import CheckInDesk from "@/components/access/CheckInDesk";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === "en" ? "Check-in" : "تسجيل الوصول" };
}

/**
 * The front desk: scan a customer's booking QR and mark them arrived.
 * The same permission as marking arrived by hand (bookings.progress).
 * A booking QR is not a venue pass: venue gates are the venue's.
 */
export default async function CheckInPage() {
  await requireDashboardAccess("bookings.progress");
  const en = (await getLang()) === "en";
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">{en ? "Check-in" : "تسجيل الوصول"}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          {en
            ? "Scan the booking code the customer shows you. If it won't scan, find the booking by name in today's appointments and check them in from there."
            : "امسح كود الحجز اللي العميل بيعرضه. لو الكود مش بيتقري، دوّر على الحجز بالاسم في مواعيد النهارده وسجّل الوصول من هناك."}
        </p>
      </header>
      <CheckInDesk />
    </div>
  );
}
