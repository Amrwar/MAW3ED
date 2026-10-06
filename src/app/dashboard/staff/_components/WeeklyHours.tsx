"use client";

import { useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export interface StaffHoursRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOff: boolean;
}

interface Props {
  staffMemberId: string;
  initial: StaffHoursRow[];
  /** Shown as the fallback when the member has no hours of their own. */
  businessHours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
}

const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Saturday first, matching the week everywhere else in the app. */
const ORDER = [6, 0, 1, 2, 3, 4, 5];

/**
 * One staff member's week.
 *
 * Empty means "same as the business", which is both the default and a
 * real answer — most people work the shop's hours. Setting hours here
 * narrows within the business window; it cannot open the shop early.
 */
export default function WeeklyHours({ staffMemberId, initial, businessHours }: Props) {
  const { t, lang } = useLanguage();
  const h = t.staffHours;
  const days = lang === "ar" ? AR_DAYS : EN_DAYS;

  const [rows, setRows] = useState<Map<number, StaffHoursRow>>(
    () => new Map(initial.map((r) => [r.dayOfWeek, r])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const usesBusinessHours = rows.size === 0;

  const businessFor = (dow: number) => businessHours.find((b) => b.dayOfWeek === dow);

  function setRow(dow: number, patch: Partial<StaffHoursRow>) {
    setSaved(false);
    setRows((prev) => {
      const next = new Map(prev);
      const current = next.get(dow) ?? {
        dayOfWeek: dow,
        startTime: businessFor(dow)?.openTime ?? "09:00",
        endTime: businessFor(dow)?.closeTime ?? "17:00",
        isOff: false,
      };
      next.set(dow, { ...current, ...patch });
      return next;
    });
  }

  function clearAll() {
    setSaved(false);
    setRows(new Map());
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/staff/${staffMemberId}/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: [...rows.values()] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? h.saveError);
        return;
      }
      setSaved(true);
    } catch {
      setError(h.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-[0.875rem] font-bold text-[var(--color-ink)]">{h.title}</h3>
        {!usesBusinessHours && (
          <button
            type="button"
            onClick={clearAll}
            className="min-h-11 text-[0.75rem] font-bold text-[var(--color-jade)] hover:underline"
          >
            {h.useBusinessHours}
          </button>
        )}
      </div>

      {usesBusinessHours && (
        <p className="m-0 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-[var(--color-subtle)]">
          {h.followingBusiness}
        </p>
      )}

      <ul className="m-0 list-none space-y-1 p-0">
        {ORDER.map((dow) => {
          const row = rows.get(dow);
          const biz = businessFor(dow);
          const bizClosed = !biz || biz.isClosed;

          return (
            <li
              key={dow}
              className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-surface-2)]"
            >
              <span className="w-20 shrink-0 text-[0.8125rem] text-[var(--color-muted)]">
                {days[dow]}
              </span>

              {bizClosed ? (
                <span className="text-[0.75rem] text-[var(--color-faint)]">{h.businessClosed}</span>
              ) : row && !row.isOff ? (
                <>
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => setRow(dow, { startTime: e.target.value })}
                    aria-label={`${days[dow]} ${h.from}`}
                    className="input num h-11 w-[7.5rem]"
                  />
                  <span aria-hidden="true" className="text-[var(--color-faint)]">—</span>
                  <input
                    type="time"
                    value={row.endTime}
                    onChange={(e) => setRow(dow, { endTime: e.target.value })}
                    aria-label={`${days[dow]} ${h.to}`}
                    className="input num h-11 w-[7.5rem]"
                  />
                  <button
                    type="button"
                    onClick={() => setRow(dow, { isOff: true })}
                    className="min-h-11 px-2 text-[0.75rem] text-[var(--color-subtle)] hover:text-[var(--color-danger)]"
                  >
                    {h.markOff}
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      "text-[0.8125rem]",
                      row?.isOff ? "text-[var(--color-danger)]" : "text-[var(--color-subtle)]",
                    )}
                  >
                    {row?.isOff ? h.off : `${biz.openTime} — ${biz.closeTime}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRow(dow, { isOff: false })}
                    className="min-h-11 px-2 text-[0.75rem] font-bold text-[var(--color-jade)] hover:underline"
                  >
                    {row?.isOff ? h.setHours : h.customise}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">{h.saved}</Alert>}

      <Button type="button" variant="outline" onClick={save} isLoading={busy} fullWidth>
        {h.save}
      </Button>
    </section>
  );
}
