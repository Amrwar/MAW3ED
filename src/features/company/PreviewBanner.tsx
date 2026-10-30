import Link from "@/components/shared/LocaleLink";
import { Eye } from "lucide-react";

/**
 * Shown across the top of a business page its owner is previewing
 * before it is published. Nobody else can reach the page at all, so
 * this never appears to a customer.
 */
export default function PreviewBanner({ lang }: { lang: "ar" | "en" }) {
  const en = lang === "en";
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[var(--color-star)] px-4 py-3 text-center text-[0.84375rem] font-bold text-[var(--color-night)]"
    >
      <span className="inline-flex items-center gap-2">
        <Eye size={16} aria-hidden="true" />
        {en
          ? "Preview — only you can see this page. Bookings you make here are test bookings."
          : "معاينة — الصفحة دي ظاهرة ليك بس. أي حجز تعمله هنا حجز تجريبي."}
      </span>
      <Link href="/dashboard/setup" className="underline underline-offset-2">
        {en ? "Back to setup" : "ارجع لتجهيز الصفحة"}
      </Link>
    </div>
  );
}
