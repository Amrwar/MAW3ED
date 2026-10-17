"use client";

import Link from "next/link";
import { countText } from "@/lib/i18n";
import {
  CalendarDays,
  CalendarPlus,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RotateCcw,
  Star,
  User2,
  X,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import type { AccountBooking } from "@/lib/account/queries";
import { useLanguage } from "@/contexts/LanguageContext";
import { telHref, whatsappHref } from "@/lib/contact";
import { money, num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

interface Props {
  booking: AccountBooking;
  /** Upcoming cards offer moving and cancelling; past ones offer rebooking. */
  variant: "upcoming" | "past";
}

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/**
 * One appointment, with everything a customer might want to do to it.
 *
 * Which actions appear follows what is actually possible: there is no
 * "cancel" on a visit that already happened, no "contact" for a
 * business that gave no number, and no "rate" until there is something
 * to rate.
 */
export default function AccountBookingCard({ booking: b, variant }: Props) {
  const { t, lang } = useLanguage();
  const c = t.account.booking;
  const isAr = lang === "ar";

  const name = !isAr && b.business.nameEn ? b.business.nameEn : b.business.nameAr;
  const place = [b.business.neighborhoodName, b.business.cityName].filter(Boolean).join(isAr ? "، " : ", ");
  const where = b.business.address || place;

  const [y, m, d] = b.date.split("-").map(Number);
  const dateLabel = isAr
    ? `${d} ${AR_MONTHS[m - 1]} ${y}`
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(y, m - 1, d)));

  /** "today", "in 3 hours", "in 4 days" — whichever is the useful one. */
  const relative = (() => {
    if (variant !== "upcoming") return null;
    const mins = b.minutesUntil;
    if (mins <= 0) return c.soon;
    if (mins < 60) return c.soon;
    if (mins < 24 * 60) return countText(lang, Math.round(mins / 60), c.inHours);
    const days = Math.round(mins / (24 * 60));
    if (days === 1) return c.tomorrow;
    return countText(lang, days, c.inDays);
  })();

  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [b.business.address, place, name].filter(Boolean).join(" "),
  )}`;

  return (
    <article className="card overflow-hidden">
      <div className="flex gap-4 p-5">
        {/* The place, so a list of appointments is scannable by logo. */}
        {b.business.logoImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.business.logoImage}
            alt=""
            loading="lazy"
            className="h-14 w-14 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] object-contain p-1.5"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] text-[1.125rem] font-extrabold text-[var(--color-jade)]"
          >
            {name.trim().charAt(0)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="m-0 min-w-0 text-[1.0625rem] font-bold text-[var(--color-ink)]">
              <Link
                href={`/company/${b.business.slug}`}
                className="inline-flex min-h-6 items-center text-inherit transition-colors hover:text-[var(--color-jade)]"
              >
                <span className="truncate">{name}</span>
              </Link>
            </h3>
            <StatusBadge status={b.status as never} lang={lang} />
          </div>

          <p className="m-0 mt-1 text-[0.875rem] text-[var(--color-muted)]">{b.serviceName}</p>

          {/* Not a <dl>: these rows have values but no terms. */}
          <div className="m-0 mt-3 grid gap-x-5 gap-y-1.5 text-[0.8125rem] sm:grid-cols-2">
            <Row icon={<CalendarDays size={13} />} value={dateLabel} extra={relative} />
            <Row
              icon={<Clock size={13} />}
              value={`${b.startTime} – ${b.endTime}`}
              ltr
              extra={`${num(b.durationMinutes, lang)} ${c.minutes}`}
            />
            {b.staffName && <Row icon={<User2 size={13} />} value={b.staffName} />}
            {where && <Row icon={<MapPin size={13} />} value={where} />}
          </div>

          {(b.branchName || b.resourceName || b.partySize !== null) && (
            <p className="m-0 mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] text-[var(--color-subtle)]">
              {b.branchName && <span>{b.branchName}</span>}
              {b.resourceName && <span>{b.resourceName}</span>}
              {b.partySize !== null && <span className="num">{num(b.partySize, lang)}</span>}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem]">
            {b.totalPrice > 0 && (
              <span className="num font-bold text-[var(--color-ink)]">
                {money(b.totalPrice, lang, b.currency)}
              </span>
            )}
            {b.depositAmount !== null && b.depositAmount > 0 && (
              <span className="text-[var(--color-subtle)]">
                {/* A second bare amount beside the price read as a second price. */}
                {c.deposit}: <span className="num">{money(b.depositAmount, lang, b.currency)}</span>
              </span>
            )}
            {b.reference && (
              <span className="num ms-auto text-[0.75rem] text-[var(--color-subtle)]" dir="ltr">
                {b.reference}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface-2)] px-5 py-3">
        {b.accessToken && (
          <Link href={`/booking/${b.accessToken}`} className="btn btn-outline btn-sm btn-pill">
            {c.view}
          </Link>
        )}

        {variant === "upcoming" && b.accessToken && (
          <>
            {b.canChange && (
              <Link
                href={`/booking/${b.accessToken}#reschedule`}
                className="btn btn-outline btn-sm btn-pill"
              >
                <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
                {c.reschedule}
              </Link>
            )}
            <a
              href={`/api/public/booking/${b.accessToken}/calendar`}
              download
              className="btn btn-outline btn-sm btn-pill"
            >
              <CalendarPlus size={13} strokeWidth={2} aria-hidden="true" />
              {c.calendar}
            </a>
            {b.canChange && (
              <Link
                href={`/booking/${b.accessToken}#cancel`}
                className="btn btn-sm btn-pill border border-[var(--color-danger-line)] bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
              >
                <X size={13} strokeWidth={2.2} aria-hidden="true" />
                {c.cancel}
              </Link>
            )}
          </>
        )}

        {where && (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm btn-pill"
          >
            <Navigation size={13} strokeWidth={2} aria-hidden="true" />
            {c.directions}
          </a>
        )}

        {b.business.whatsapp && (
          <a
            href={whatsappHref(b.business.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline btn-sm btn-pill"
          >
            <MessageCircle size={13} strokeWidth={2} aria-hidden="true" />
            {c.whatsapp}
          </a>
        )}

        {b.business.phone && (
          <a href={telHref(b.business.phone)} className="btn btn-outline btn-sm btn-pill">
            <Phone size={13} strokeWidth={2} aria-hidden="true" />
            {c.call}
          </a>
        )}

        {variant === "past" && (
          <Link
            href={`/company/${b.business.slug}#booking`}
            className={cn("btn btn-sm btn-pill ms-auto", b.canReview ? "btn-outline" : "btn-primary")}
          >
            <RotateCcw size={13} strokeWidth={2} aria-hidden="true" />
            {c.rebook}
          </Link>
        )}

        {/* Only where the visit completed and has not been rated. */}
        {b.canReview && b.accessToken && (
          <Link href={`/booking/${b.accessToken}#review`} className="btn btn-primary btn-sm btn-pill">
            <Star size={13} strokeWidth={2} aria-hidden="true" />
            {c.review}
          </Link>
        )}
      </div>
    </article>
  );
}

function Row({
  icon,
  value,
  extra,
  ltr,
}: {
  icon: React.ReactNode;
  value: string;
  extra?: string | null;
  ltr?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[var(--color-muted)]">
      <span aria-hidden="true" className="shrink-0 text-[var(--color-subtle)]">
        {icon}
      </span>
      <span className={cn("truncate", ltr && "num")} dir={ltr ? "ltr" : undefined}>
        {value}
      </span>
      {extra && (
        <span className="shrink-0 text-[0.75rem] text-[var(--color-jade)]">· {extra}</span>
      )}
    </div>
  );
}
