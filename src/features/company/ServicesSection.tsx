"use client";

import { CalendarClock, Clock, Users } from "lucide-react";
import { countText } from "@/lib/i18n";
import type { Service } from "@/types/service";
import { useLanguage } from "@/contexts/LanguageContext";
import { clock12, duration as fmtDuration, money } from "@/lib/fmt";

export interface ServiceProvider {
  id: string;
  name: string;
  serviceIds: string[];
}

interface Props {
  services: Service[];
  /** Staff who can perform these, where the business has any. */
  providers: ServiceProvider[];
  /**
   * The first free appointment for the business, shared across its
   * services. Null when nothing is bookable inside the horizon.
   */
  nextSlot: { dayOffset: number; time: string } | null;
  onBook?: (service: Service) => void;
}

/**
 * The menu.
 *
 * A service shows a price only when one is set. The default is zero,
 * and three live listings sit on it — advertising "0 ج.م" reads as free
 * when it means nobody filled the field in.
 */
export default function ServicesSection({ services, providers, nextSlot, onBook }: Props) {
  const { t, lang } = useLanguage();
  const s = t.services;

  if (services.length === 0) return null;

  const dayLabel = (offset: number) =>
    offset === 0 ? s.today : offset === 1 ? s.tomorrow : countText(lang, offset, s.inDays);

  return (
    <section id="services" className="scroll-mt-32">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="m-0 text-[1.5rem] font-bold text-[var(--color-ink)]">{s.title}</h2>
        <span className="text-[0.8125rem] text-[var(--color-subtle)]">
          {countText(lang, services.length, s.countWord)}
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {services.map((service) => {
          const who = providers.filter((p) => p.serviceIds.includes(service.id));

          return (
            <li
              key={service.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4"
            >
              <div className="min-w-0 flex-[1_1_16rem]">
                {/* English when the business gave one. Otherwise the Arabic
                    name, marked as Arabic so it is shaped, aligned and read
                    aloud as Arabic inside an English page. */}
                <h3
                  className="m-0 text-base font-bold text-[var(--color-ink)]"
                  {...(lang === "en" && !service.nameEn ? { lang: "ar", dir: "rtl" } : {})}
                >
                  {lang === "en" && service.nameEn ? service.nameEn : service.nameAr}
                </h3>

                {service.descriptionAr && (
                  <p
                    {...(lang === "en" ? { lang: "ar", dir: "rtl" } : {})}
                    className="m-0 mt-1.5 line-clamp-2 text-[0.84375rem] leading-relaxed text-[var(--color-subtle)]">
                    {service.descriptionAr}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem] text-[var(--color-subtle)]">
                  {service.duration > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Clock size={13} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                      {fmtDuration(service.duration, lang)}
                    </span>
                  )}

                  {/* Who performs it, where the business keeps staff. */}
                  {who.length > 0 && (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Users size={13} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">
                        {who.length === 1
                          ? who[0].name
                          : countText(lang, who.length, s.providerCount)}
                      </span>
                    </span>
                  )}

                  {nextSlot && (
                    <span className="flex items-center gap-1.5 text-[var(--color-jade)]">
                      <CalendarClock size={13} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />
                      {s.nextFree} {dayLabel(nextSlot.dayOffset)}{" "}
                      <span>{clock12(nextSlot.time, lang)}</span>
                    </span>
                  )}
                </div>
              </div>

              <span className="shrink-0 text-end">
                {service.price > 0 ? (
                  <span className="num block text-[1.125rem] font-extrabold text-[var(--color-ink)]">
                    {money(service.price, lang, service.currency)}
                  </span>
                ) : (
                  <span className="block text-[0.84375rem] text-[var(--color-subtle)]">
                    {s.priceUnset}
                  </span>
                )}
              </span>

              <button
                type="button"
                onClick={() => onBook?.(service)}
                className="btn btn-jade-outline btn-sm shrink-0"
              >
                {s.book}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
