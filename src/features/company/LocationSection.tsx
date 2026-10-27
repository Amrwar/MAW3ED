"use client";

import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import type { DayHours } from "@/lib/discovery/hours";
import { cairoNow } from "@/lib/discovery/hours";
import { useLanguage } from "@/contexts/LanguageContext";
import { clock12 } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { telHref } from "@/lib/contact";

interface Props {
  name: string;
  address: string | null;
  cityName: string;
  neighborhoodName: string | null;
  phone: string | null;
  hours: DayHours[];
}

/**
 * Where it is and when it is open.
 *
 * No map: neither City nor Business carries coordinates, and dropping a
 * pin on a guessed location would be worse than not showing one. The
 * directions link hands the address to the map the visitor already
 * uses, which is where they were going to end up anyway.
 */
export default function LocationSection({
  name,
  address,
  cityName,
  neighborhoodName,
  phone,
  hours,
}: Props) {
  const { t, lang } = useLanguage();
  const l = t.location;
  const isAr = lang === "ar";

  const place = [neighborhoodName, cityName].filter(Boolean).join(isAr ? "، " : ", ");
  const query = encodeURIComponent([address, place, name].filter(Boolean).join(" "));
  const today = cairoNow().dayOfWeek;

  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  const dayNames = isAr ? l.daysAr : l.daysEn;

  return (
    <section id="location" className="scroll-mt-32">
      <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">{l.title}</h2>

      <div className="grid gap-5 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:grid-cols-2">

        {/* ── Address and contact ── */}
        <div className="min-w-0">
          <h3 className="m-0 flex items-center gap-2 text-[0.8125rem] font-bold text-[var(--color-subtle)]">
            <MapPin size={14} strokeWidth={1.9} aria-hidden="true" />
            {l.address}
          </h3>

          <p className="m-0 mt-2.5 text-[0.9375rem] leading-[1.7] text-[var(--color-ink)]">
            {address || place}
          </p>
          {address && place && (
            <p className="m-0 mt-1 text-[0.8125rem] text-[var(--color-subtle)]">{place}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm btn-pill"
            >
              <Navigation size={14} strokeWidth={2} aria-hidden="true" />
              {l.directions}
            </a>
            {phone && (
              <a href={telHref(phone)} className="btn btn-outline btn-sm btn-pill">
                <Phone size={14} strokeWidth={2} aria-hidden="true" />
                <span className="num">{phone}</span>
              </a>
            )}
          </div>
        </div>

        {/* ── Opening hours ── */}
        <div className="min-w-0">
          <h3 className="m-0 flex items-center gap-2 text-[0.8125rem] font-bold text-[var(--color-subtle)]">
            <Clock size={14} strokeWidth={1.9} aria-hidden="true" />
            {l.hours}
          </h3>

          {hours.length === 0 ? (
            <p className="m-0 mt-2.5 text-[0.875rem] text-[var(--color-subtle)]">{l.noHours}</p>
          ) : (
            <ul className="m-0 mt-2.5 list-none space-y-0.5 p-0">
              {[0, 1, 2, 3, 4, 5, 6].map((d) => {
                const rule = byDay.get(d);
                const isToday = d === today;
                return (
                  <li
                    key={d}
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-[var(--radius-sm)] px-2 py-1.5 text-[0.84375rem]",
                      isToday && "bg-[var(--color-jade-tint)] font-bold",
                    )}
                  >
                    <span className={isToday ? "text-[var(--color-ink)]" : "text-[var(--color-muted)]"}>
                      {dayNames[d]}
                      {/* A real space, not only a margin: copied or read
                          aloud, the margin alone gave "Tuesdaytoday". */}
                      {isToday && " "}
                      {isToday && (
                        <span className="ms-1 text-[0.6875rem] font-normal text-[var(--color-jade)]">
                          {l.todayMarker}
                        </span>
                      )}
                    </span>

                    {!rule || rule.isClosed ? (
                      <span className="text-[var(--color-subtle)]">{l.closed}</span>
                    ) : (
                      // Not .num: it forces left-to-right, which would
                      // put the closing time first for an Arabic reader.
                      <span className="tabular-nums text-[var(--color-ink)]">
                        {clock12(rule.openTime, lang)} — {clock12(rule.closeTime, lang)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
