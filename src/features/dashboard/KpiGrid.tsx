"use client";

import Link from "next/link";
import {
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCheck,
  CircleUser,
  Repeat,
  Sun,
  Wallet,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { arCount, enCount, money, num } from "@/lib/fmt";

const DAYS = { one: "يوم واحد", two: "يومين", few: "أيام", many: "يوم" };

export interface Kpis {
  todayTotal: number;
  todayUpcoming: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShows: number;
  revenue: number;
  newCustomers: number;
  returningCustomers: number;
  windowDays: number;
  neverBooked: boolean;
}

/**
 * The numbers worth leading with.
 *
 * Each one is counted from booking rows when the page loads. There is
 * no projection, no trend line and no percentage against last month —
 * a business with eleven bookings does not have a trend, and showing
 * one would be inventing a story the data cannot support.
 *
 * Today is the Cairo day. The rest is the last `windowDays`, and the
 * card says so rather than leaving the reader to assume.
 */
export default function KpiGrid({ kpis }: { kpis: Kpis }) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const n = (v: number) => num(v, lang);

  if (kpis.neverBooked) {
    return (
      <section className="card p-6 text-center">
        <p className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">
          {ar ? "لسه مفيش حجوزات" : "No bookings yet"}
        </p>
        <p className="m-0 mt-1.5 text-[0.8125rem] leading-relaxed text-[var(--color-subtle)]">
          {ar
            ? "أول ما حد يحجز، الأرقام هنا هتتملي لوحدها. مفيش حاجة هنا دلوقتي عشان مفيش حاجة حصلت."
            : "The moment somebody books, these numbers fill themselves in. There is nothing here yet because nothing has happened yet."}
        </p>
        <Link href="/dashboard/services" className="btn btn-primary btn-sm mt-4">
          {ar ? "راجع خدماتك" : "Review your services"}
        </Link>
      </section>
    );
  }

  const period = ar ? `آخر ${arCount(kpis.windowDays, DAYS)}` : `Last ${enCount(kpis.windowDays, "day")}`;

  return (
    <div className="space-y-3">
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
        <Card
          href="/dashboard/bookings/today"
          icon={Sun}
          label={ar ? "النهارده" : "Today"}
          value={n(kpis.todayTotal)}
          hint={
            kpis.todayUpcoming > 0
              ? ar
                ? `${n(kpis.todayUpcoming)} لسه جاي`
                : `${n(kpis.todayUpcoming)} still to come`
              : ar
                ? "خلصت كلها"
                : "all done"
          }
        />
        <Card
          href="/dashboard/bookings/upcoming"
          icon={CalendarClock}
          label={ar ? "مواعيد جاية" : "Upcoming"}
          value={n(kpis.upcoming)}
          hint={ar ? "من دلوقتي" : "from now on"}
        />
        <Card
          icon={CheckCheck}
          label={ar ? "تمّت" : "Completed"}
          value={n(kpis.completed)}
          hint={period}
        />
        <Card
          icon={Wallet}
          label={ar ? "إيرادات" : "Revenue"}
          value={kpis.revenue > 0 ? money(kpis.revenue, lang) : "—"}
          hint={ar ? `${period} · من المواعيد اللي تمّت` : `${period} · completed only`}
        />
      </ul>

      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
        <Card
          icon={CalendarX}
          label={ar ? "إلغاءات" : "Cancellations"}
          value={n(kpis.cancelled)}
          hint={period}
          tone={kpis.cancelled > 0 ? "warn" : undefined}
        />
        <Card
          href="/dashboard/customers?noShows=1"
          icon={CalendarCheck}
          label={ar ? "غياب" : "No-shows"}
          value={n(kpis.noShows)}
          hint={period}
          tone={kpis.noShows > 0 ? "danger" : undefined}
        />
        <Card
          href="/dashboard/customers"
          icon={CircleUser}
          label={ar ? "عملاء جدد" : "New customers"}
          value={n(kpis.newCustomers)}
          hint={period}
        />
        <Card
          href="/dashboard/customers?returning=1"
          icon={Repeat}
          label={ar ? "عملاء رجعوا" : "Returning"}
          value={n(kpis.returningCustomers)}
          hint={period}
        />
      </ul>
    </div>
  );
}

function Card({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  href?: string;
  icon: typeof Sun;
  label: string;
  value: string;
  hint?: string;
  tone?: "warn" | "danger";
}) {
  const colour =
    tone === "danger"
      ? "var(--color-danger)"
      : tone === "warn"
        ? "var(--color-warn)"
        : "var(--color-ink)";

  const inner = (
    <>
      <Icon
        size={16}
        strokeWidth={1.8}
        aria-hidden="true"
        className="text-[var(--color-jade)]"
      />
      <span className="mt-auto block">
        <span
          className="num block text-[1.375rem] font-bold leading-none"
          style={{ color: colour }}
        >
          {value}
        </span>
        <span className="mt-1 block text-[0.75rem] font-bold text-[var(--color-ink-2)]">
          {label}
        </span>
        {hint && (
          <span className="mt-0.5 block text-[0.6875rem] leading-snug text-[var(--color-subtle)]">
            {hint}
          </span>
        )}
      </span>
    </>
  );

  const className = "card flex min-h-[7rem] flex-col p-4";

  return (
    <li>
      {href ? (
        <Link href={href} className={`${className} card-hover`}>
          {inner}
        </Link>
      ) : (
        <div className={className}>{inner}</div>
      )}
    </li>
  );
}
