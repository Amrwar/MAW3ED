"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export interface TimeBlockRow {
  id: string;
  kind: "BREAK" | "HOLIDAY" | "VACATION" | "CLOSURE";
  staffMemberId: string | null;
  dayOfWeek: number | null;
  startsOn: string | null;
  endsOn: string | null;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
}

interface Props {
  /** Null manages the whole business; an id manages one person. */
  staffMemberId: string | null;
  initial: TimeBlockRow[];
}

const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDER = [6, 0, 1, 2, 3, 4, 5];

/**
 * Time taken out of the calendar.
 *
 * A recurring break (lunch every Tuesday) and a dated absence (away
 * next week) are the same record with different fields filled in, so
 * they are one form with one switch rather than two features that
 * drift apart.
 */
export default function TimeBlocks({ staffMemberId, initial }: Props) {
  const { t, lang } = useLanguage();
  const b = t.timeBlocks;
  const days = lang === "ar" ? AR_DAYS : EN_DAYS;

  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    repeats: "weekly" as "weekly" | "dates",
    kind: (staffMemberId ? "VACATION" : "HOLIDAY") as TimeBlockRow["kind"],
    dayOfWeek: 1,
    startsOn: "",
    endsOn: "",
    allDay: true,
    startTime: "13:00",
    endTime: "14:00",
    reason: "",
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const weekly = form.repeats === "weekly";
    const payload = {
      // A recurring block is a break; a dated one is an absence.
      kind: weekly ? "BREAK" : form.kind,
      staffMemberId,
      dayOfWeek: weekly ? form.dayOfWeek : null,
      startsOn: weekly ? null : form.startsOn || null,
      endsOn: weekly ? null : form.endsOn || form.startsOn || null,
      startTime: form.allDay ? null : form.startTime,
      endTime: form.allDay ? null : form.endTime,
      reason: form.reason.trim() || null,
    };

    try {
      const res = await fetch("/api/business/time-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? b.saveError);
        return;
      }
      setRows((prev) => [...prev, data.block]);
      setAdding(false);
    } catch {
      setError(b.saveError);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/business/time-blocks?id=${id}`, { method: "DELETE" });
      if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setBusy(false);
    }
  }

  const describe = (r: TimeBlockRow) => {
    const when =
      r.dayOfWeek !== null
        ? `${b.every} ${days[r.dayOfWeek]}`
        : r.endsOn && r.endsOn !== r.startsOn
          ? `${r.startsOn} → ${r.endsOn}`
          : (r.startsOn ?? "");
    const hours = r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : b.allDay;
    return `${when} · ${hours}`;
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-[0.875rem] font-bold text-[var(--color-ink)]">
          {staffMemberId ? b.titleStaff : b.titleBusiness}
        </h3>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-11 items-center gap-1 text-[0.75rem] font-bold text-[var(--color-jade)] hover:underline"
          >
            <Plus size={13} strokeWidth={2.4} aria-hidden="true" />
            {b.add}
          </button>
        )}
      </div>

      {rows.length === 0 && !adding && (
        <p className="m-0 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-[var(--color-subtle)]">
          {b.empty}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="m-0 list-none space-y-1.5 p-0">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2.5"
            >
              <span
                className={cn(
                  "badge shrink-0",
                  r.kind === "VACATION" || r.kind === "HOLIDAY" ? "badge-warning" : "badge-default",
                )}
              >
                {b.kinds[r.kind]}
              </span>
              <span className="num min-w-0 flex-1 truncate text-[0.8125rem] text-[var(--color-ink)]">
                {describe(r)}
                {r.reason ? ` — ${r.reason}` : ""}
              </span>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={busy}
                aria-label={b.remove}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
              >
                <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form
          onSubmit={add}
          className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4"
        >
          <Select
            label={b.repeats}
            value={form.repeats}
            onChange={(e) => setForm({ ...form, repeats: e.target.value as "weekly" | "dates" })}
          >
            <option value="weekly">{b.weekly}</option>
            <option value="dates">{b.dates}</option>
          </Select>

          {form.repeats === "weekly" ? (
            <Select
              label={b.day}
              value={String(form.dayOfWeek)}
              onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
            >
              {ORDER.map((d) => (
                <option key={d} value={d}>
                  {days[d]}
                </option>
              ))}
            </Select>
          ) : (
            <>
              <Select
                label={b.kind}
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as TimeBlockRow["kind"] })
                }
              >
                {(staffMemberId ? (["VACATION"] as const) : (["HOLIDAY", "CLOSURE"] as const)).map(
                  (k) => (
                    <option key={k} value={k}>
                      {b.kinds[k]}
                    </option>
                  ),
                )}
              </Select>
              <div className="flex gap-2">
                <Input
                  label={b.from}
                  type="date"
                  value={form.startsOn}
                  onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
                  required
                />
                <Input
                  label={b.to}
                  type="date"
                  value={form.endsOn}
                  onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
                  hint={b.toHint}
                />
              </div>
            </>
          )}

          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
              className="h-5 w-5 accent-[var(--color-jade)]"
            />
            <span className="text-[0.875rem] text-[var(--color-ink)]">{b.allDayLabel}</span>
          </label>

          {!form.allDay && (
            <div className="flex gap-2">
              <Input
                label={b.fromTime}
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              />
              <Input
                label={b.toTime}
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              />
            </div>
          )}

          <Input
            label={b.reason}
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder={b.reasonPlaceholder}
          />

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="flex-1"
            >
              {b.cancel}
            </Button>
            <Button type="submit" variant="primary" isLoading={busy} className="flex-1">
              {b.save}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
