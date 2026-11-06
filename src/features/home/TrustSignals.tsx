"use client";

import { BadgeCheck, CalendarCheck, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { clock12, money, num } from "@/lib/fmt";
import type { PlatformReach } from "@/lib/data";

interface Props {
  /** Null while there are too few listings for a count to help (SHOW_COUNTS_FROM). */
  reach: PlatformReach | null;
}

/**
 * What a visitor gets, not how many people got it before them.
 *
 * The section this replaces advertised "300+ businesses", "12,000+
 * bookings" and "98% satisfaction" against five listings, four
 * bookings and no reviews table — the figures were written into the
 * translation file by hand. Everything here is either a promise the
 * product actually keeps or a number counted out of the database.
 */
export default function TrustSignals({ reach }: Props) {
  const { t, lang } = useLanguage();
  const ts = t.trustSignals;


  /**
   * Counted, never written down. A figure that is still zero says
   * nothing worth saying, so it is left out rather than shown as "0".
   */
  const figures = reach
    ? [
        { value: reach.businesses, label: ts.countBusinesses },
        { value: reach.cities,     label: ts.countCities },
        { value: reach.categories, label: ts.countCategories },
      ].filter((f) => f.value > 0)
    : [];

  const en = lang === "en";

  /** Each promise with what it looks like in the product: samples, not records. */
  const promises = [
    { Icon: BadgeCheck, title: ts.verifiedTitle, body: ts.verifiedBody, proof: (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 text-[0.84375rem]">
      <BadgeCheck size={16} className="text-[var(--color-jade)]" />
      <strong className="text-[var(--color-ok)]">{en ? "Verified" : "موثّق"}</strong>
      <span className="text-[var(--color-subtle)]">{en ? "· by documents" : "· بالمستندات"}</span>
    </span>
    ) },
    { Icon: CalendarCheck, title: ts.instantTitle, body: ts.instantBody, proof: (
    <span className="flex gap-2">
      {["16:00", "16:30", "18:00"].map((x) => (
        <span
          key={x}
          className={cn(
            "num rounded-[var(--radius-md)] border px-3.5 py-2 text-[0.875rem] font-bold",
            x === "16:30"
              ? "border-[var(--color-jade)] bg-[var(--color-jade)] text-[var(--color-inverse)]"
              : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]",
          )}
        >
          {clock12(x, lang)}
        </span>
      ))}
    </span>
    ) },
    { Icon: ShieldCheck, title: ts.noFeesTitle, body: ts.noFeesBody, proof: (
    <span className="block rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-1 text-[0.8125rem]">
      <span className="flex justify-between gap-3 border-b border-dashed border-[var(--color-line)] py-2">
        <span className="text-[var(--color-muted)]">{en ? "Paid to the business" : "بتدفعها للنشاط"}</span>
        <strong className="num shrink-0 text-[var(--color-ink)]">{money(150, lang, "EGP")}</strong>
      </span>
      <span className="flex justify-between gap-3 py-2">
        <span className="text-[var(--color-muted)]">{en ? "Maw3ed booking fee" : "رسوم حجز موعد"}</span>
        <strong className="shrink-0 text-[var(--color-ok)]">{en ? "None" : "ولا حاجة"}</strong>
      </span>
    </span>
    ) },
    { Icon: MessageCircle, title: ts.arabicTitle, body: ts.arabicBody, proof: (
    <span dir="rtl" lang="ar" className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 text-[0.9375rem] font-bold text-[var(--color-ink)]">
      <CheckCircle2 size={16} className="shrink-0 text-[var(--color-jade)]" />
      تم تأكيد حجزك
    </span>
    ) },
  ];

  return (
    <section className="bg-[var(--color-surface-2)] py-20">
      <div className="container-app">

        <div className="mb-12 grid items-end gap-5 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0">
            <span className="section-eyebrow">{ts.eyebrow}</span>
            <h2 className="section-title mt-2.5">{ts.title}</h2>
          </div>
          <p className="m-0 max-w-[34rem] text-[0.96875rem] leading-[1.75] text-[var(--color-muted)]">{ts.intro}</p>
        </div>

        <ul className="grid list-none grid-cols-1 gap-x-8 gap-y-12 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map(({ Icon, title, body, proof }) => (
            <li key={title} className="flex min-w-0 flex-col border-t-2 border-[var(--color-jade)] pt-6">
              <Icon size={21} strokeWidth={1.8} aria-hidden="true" className="mb-4 text-[var(--color-jade)]" />
              <h3 className="m-0 text-[1.0625rem] font-bold text-[var(--color-ink)]">{title}</h3>
              <p className="m-0 mt-2.5 text-[0.875rem] leading-[1.75] text-[var(--color-muted)]">{body}</p>
              {/* A picture of the promise, not a claim of its own. */}
              <div aria-hidden="true" className="mt-6 sm:mt-auto sm:pt-6">{proof}</div>
            </li>
          ))}
        </ul>

        {figures.length > 0 && (
          <div className="mt-14 flex flex-wrap items-center gap-x-10 gap-y-5 border-t border-[var(--color-line-2)] pt-8">
            {figures.map((f) => (
              <p key={f.label} className="m-0 flex items-baseline gap-2">
                <span className="num text-[1.375rem] font-bold leading-none text-[var(--color-ink)]">
                  {num(f.value, lang)}
                </span>
                <span className="text-[0.84375rem] text-[var(--color-subtle)]">{f.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
