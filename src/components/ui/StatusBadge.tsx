import { cn } from "@/lib/utils";
import type { Lang } from "@/lib/i18n";

export type BookingStatusKey =
  | "PENDING_PAYMENT"
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "FAILED_PAYMENT";

/**
 * Status is carried by colour *and* by lightness, so the states stay
 * distinguishable without relying on hue alone.
 */
const STATUS: Record<
  BookingStatusKey,
  { cls: string; ar: string; en: string }
> = {
  PENDING_PAYMENT: { cls: "badge-warning", ar: "بانتظار الدفع",   en: "Awaiting payment" },
  PENDING:         { cls: "badge-warning", ar: "في الانتظار",     en: "Pending" },
  CONFIRMED:       { cls: "badge-success", ar: "مؤكّد",           en: "Confirmed" },
  COMPLETED:       { cls: "badge-default", ar: "مكتمل",           en: "Completed" },
  CANCELLED:       { cls: "badge-danger",  ar: "ملغي",            en: "Cancelled" },
  NO_SHOW:         { cls: "badge-danger",  ar: "لم يحضر",         en: "No-show" },
  FAILED_PAYMENT:  { cls: "badge-danger",  ar: "فشل الدفع",       en: "Payment failed" },
};

export default function StatusBadge({
  status,
  lang = "ar",
  className,
}: {
  status: BookingStatusKey | string;
  lang?: Lang;
  className?: string;
}) {
  const entry = STATUS[status as BookingStatusKey];
  if (!entry) {
    return <span className={cn("badge badge-default", className)}>{status}</span>;
  }
  return (
    <span className={cn("badge", entry.cls, className)}>
      {lang === "en" ? entry.en : entry.ar}
    </span>
  );
}

/** The accent stripe colour a booking gets in the calendar. */
export function statusStripe(status: BookingStatusKey | string): string {
  switch (status) {
    case "CONFIRMED":
    case "COMPLETED":
      return "var(--color-jade)";
    case "PENDING":
    case "PENDING_PAYMENT":
      return "#C9A227";
    case "CANCELLED":
    case "NO_SHOW":
    case "FAILED_PAYMENT":
      return "var(--color-danger)";
    default:
      return "var(--color-line-2)";
  }
}
