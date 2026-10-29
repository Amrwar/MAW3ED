"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Tabs from "@/components/ui/Tabs";
import type {
  CalendarBlock,
  CalendarEntry,
  CalendarView,
} from "@/lib/scheduling/calendar";
import { addDays } from "@/lib/bookings/instants";
import { useLanguage } from "@/contexts/LanguageContext";
import { num, clockRange } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import CalendarGrid from "./CalendarGrid";

export interface FilterOption {
  id: string;
  label: string;
}

interface Props {
  view: CalendarView;
  anchor: string;
  from: string;
  to: string;
  entries: CalendarEntry[];
  blocks: CalendarBlock[];
  dayStartMin: number;
  dayEndMin: number;
  staff: FilterOption[];
  services: FilterOption[];
  branches: FilterOption[];
  resources: FilterOption[];
  resourceWord: string;
  selected: {
    staffMemberId: string | null;
    serviceId: string | null;
    branchId: string | null;
    resourceId: string | null;
    statuses: string[];
  };
}

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
] as const;

/**
 * The owner's calendar.
 *
 * View, date and every filter live in the URL, so a particular day
 * filtered to one chair is a link somebody can be sent, a refresh keeps
 * it, and the back button walks it.
 */
export default function CalendarClient(props: Props) {
  const { t, lang } = useLanguage();
  const c = t.calendar;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<CalendarEntry | null>(null);

  const push = useCallback(
    (patch: Record<string, string | null>) => {
      const p = new URLSearchParams();
      const base: Record<string, string | null> = {
        view: props.view,
        date: props.anchor,
        staff: props.selected.staffMemberId,
        service: props.selected.serviceId,
        branch: props.selected.branchId,
        resource: props.selected.resourceId,
        status: props.selected.statuses.join(",") || null,
        ...patch,
      };
      for (const [k, v] of Object.entries(base)) {
        if (v) p.set(k, v);
      }
      startTransition(() => router.push(`${pathname}?${p}`, { scroll: false }));
    },
    [props.view, props.anchor, props.selected, pathname, router],
  );

  /** How far one arrow press moves, per view. */
  const step = props.view === "day" ? 1 : props.view === "week" ? 7 : 30;

  const shift = (direction: -1 | 1) => {
    if (props.view === "month") {
      const [y, m] = props.anchor.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 + direction, 1));
      push({ date: d.toISOString().slice(0, 10) });
      return;
    }
    push({ date: addDays(props.anchor, direction * step) });
  };

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date()),
    [],
  );

  const activeFilters =
    (props.selected.staffMemberId ? 1 : 0) +
    (props.selected.serviceId ? 1 : 0) +
    (props.selected.branchId ? 1 : 0) +
    (props.selected.resourceId ? 1 : 0) +
    (props.selected.statuses.length > 0 ? 1 : 0);

  const heading = formatRange(props.view, props.anchor, props.from, props.to, lang);

  const PrevIcon = lang === "ar" ? ChevronRight : ChevronLeft;
  const NextIcon = lang === "ar" ? ChevronLeft : ChevronRight;

  const filterPanel = (
    <div className="flex flex-col gap-6">
      <FilterGroup
        title={c.staff}
        options={props.staff}
        value={props.selected.staffMemberId}
        onChange={(v) => push({ staff: v })}
        allLabel={c.allStaff}
      />
      <FilterGroup
        title={c.service}
        options={props.services}
        value={props.selected.serviceId}
        onChange={(v) => push({ service: v })}
        allLabel={c.allServices}
      />
      {props.branches.length > 0 && (
        <FilterGroup
          title={c.branch}
          options={props.branches}
          value={props.selected.branchId}
          onChange={(v) => push({ branch: v })}
          allLabel={c.allBranches}
        />
      )}
      {props.resources.length > 0 && (
        <FilterGroup
          title={props.resourceWord}
          options={props.resources}
          value={props.selected.resourceId}
          onChange={(v) => push({ resource: v })}
          allLabel={c.all}
        />
      )}

      <section>
        <h3 className="m-0 mb-2.5 text-[0.8125rem] font-bold text-[var(--color-ink)]">
          {c.status}
        </h3>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((st) => {
            const on = props.selected.statuses.includes(st);
            return (
              <button
                key={st}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = on
                    ? props.selected.statuses.filter((x) => x !== st)
                    : [...props.selected.statuses, st];
                  push({ status: next.join(",") || null });
                }}
                className={cn("chip", on && "chip-active")}
              >
                {(t.dashboard.bookingStatus as Record<string, string>)[st] ?? st}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={c.previous}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <PrevIcon size={17} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={c.next}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <NextIcon size={17} strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => push({ date: today })}
            className="btn btn-outline btn-sm ms-1"
          >
            {c.today}
          </button>
        </div>

        <h2 className="m-0 min-w-0 flex-1 text-[1.0625rem] font-bold text-[var(--color-ink)]">
          {heading}
        </h2>

        <Tabs
          label={c.view}
          value={props.view}
          onChange={(v) => push({ view: v })}
          items={[
            { value: "day", label: c.day },
            { value: "week", label: c.week },
            { value: "month", label: c.month },
          ]}
          className="shrink-0"
        />

        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="btn btn-outline btn-sm shrink-0 xl:hidden"
        >
          <Filter size={15} strokeWidth={1.9} aria-hidden="true" />
          {c.filters}
          {activeFilters > 0 && (
            <span className="num rounded-full bg-[var(--color-jade)] px-1.5 text-[0.6875rem] font-bold text-[var(--color-inverse)]">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-start gap-6">
        <aside className="hidden w-[15rem] shrink-0 xl:block">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-[0.875rem] font-bold text-[var(--color-ink)]">
                {c.filters}
              </h3>
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      router.push(`${pathname}?view=${props.view}&date=${props.anchor}`, {
                        scroll: false,
                      }),
                    )
                  }
                  className="text-[0.75rem] font-bold text-[var(--color-jade)] hover:underline"
                >
                  {c.clear}
                </button>
              )}
            </div>
            {filterPanel}
          </div>
        </aside>

        <div className={cn("min-w-0 flex-1 transition-opacity", pending && "opacity-60")}>
          <div className="card overflow-hidden">
            {props.entries.length === 0 && props.blocks.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={24} strokeWidth={1.7} />}
                title={c.emptyTitle}
                body={activeFilters > 0 ? c.emptyFiltered : c.emptyBody}
              />
            ) : (
              <CalendarGrid
                view={props.view}
                from={props.from}
                to={props.to}
                entries={props.entries}
                blocks={props.blocks}
                dayStartMin={props.dayStartMin}
                dayEndMin={props.dayEndMin}
                onSelect={setDetail}
              />
            )}
          </div>

          <p className="num mt-3 text-[0.8125rem] text-[var(--color-subtle)]">
            {num(props.entries.length, lang)} {c.appointments}
          </p>
        </div>
      </div>

      {/* ── Filters on a narrow screen ── */}
      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        variant="sheet"
        title={c.filters}
        footer={
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="btn btn-primary w-full"
          >
            {c.done}
          </button>
        }
      >
        {filterPanel}
      </Modal>

      {/* ── One appointment ── */}
      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        variant="sheet"
        title={detail?.customerName ?? ""}
        description={detail?.reference ?? undefined}
      >
        {detail && (
          <dl className="m-0 space-y-3">
            <Field label={c.service} value={detail.serviceName} />
            <Field label={c.time} value={clockRange(detail.startTime, detail.endTime)} ltr />
            <Field
              label={c.duration}
              value={`${num(detail.durationMinutes, lang)} ${c.minutes}`}
            />
            {detail.staffName && <Field label={c.staff} value={detail.staffName} />}
            {detail.resourceName && (
              <Field label={props.resourceWord} value={detail.resourceName} />
            )}
            {detail.branchName && <Field label={c.branch} value={detail.branchName} />}
            {detail.partySize !== null && (
              <Field label={c.partySize} value={num(detail.partySize, lang)} />
            )}
            <Field label={c.phone} value={detail.customerPhone} ltr />
            <Field
              label={c.status}
              value={
                (t.dashboard.bookingStatus as Record<string, string>)[detail.status] ??
                detail.status
              }
            />
            {detail.notes && <Field label={c.notes} value={detail.notes} />}

            <div className="pt-2">
              <a
                href={`/dashboard/bookings?focus=${detail.id}`}
                className="btn btn-primary btn-sm w-full"
              >
                {c.openBooking}
              </a>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}

/* ─── Pieces ─────────────────────────────────────────────── */

function FilterGroup({
  title,
  options,
  value,
  onChange,
  allLabel,
}: {
  title: string;
  options: FilterOption[];
  value: string | null;
  onChange: (v: string | null) => void;
  allLabel: string;
}) {
  if (options.length === 0) return null;

  return (
    <section>
      <h3 className="m-0 mb-2 text-[0.8125rem] font-bold text-[var(--color-ink)]">{title}</h3>
      <ul className="m-0 flex max-h-56 list-none flex-col gap-0.5 overflow-y-auto p-0">
        <li>
          <FilterRow label={allLabel} active={value === null} onClick={() => onChange(null)} />
        </li>
        {options.map((o) => (
          <li key={o.id}>
            <FilterRow
              label={o.label}
              active={value === o.id}
              onClick={() => onChange(value === o.id ? null : o.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FilterRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 w-full items-center rounded-[var(--radius-sm)] px-3 text-start text-[0.875rem] transition-colors",
        active
          ? "bg-[var(--color-jade-soft)] font-bold text-[var(--color-ok)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]",
      )}
    >
      <span className="truncate">{label}</span>
      {active && <X size={13} strokeWidth={2.4} aria-hidden="true" className="ms-auto shrink-0" />}
    </button>
  );
}

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] pb-2.5 last:border-b-0">
      <dt className="shrink-0 text-[0.8125rem] text-[var(--color-subtle)]">{label}</dt>
      <dd
        className={cn("m-0 text-end text-[0.875rem] font-bold text-[var(--color-ink)]", ltr && "num")}
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

/* ─── Heading ────────────────────────────────────────────── */

const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatRange(
  view: CalendarView,
  anchor: string,
  from: string,
  to: string,
  lang: "ar" | "en",
): string {
  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB", {
      timeZone: "UTC",
      ...opts,
    }).format(new Date(iso + "T00:00:00Z"));

  if (view === "day") {
    return fmt(anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  if (view === "week") {
    const sameMonth = from.slice(0, 7) === to.slice(0, 7);
    return sameMonth
      ? `${Number(from.slice(-2))} – ${fmt(to, { day: "numeric", month: "long", year: "numeric" })}`
      : `${fmt(from, { day: "numeric", month: "short" })} – ${fmt(to, { day: "numeric", month: "short", year: "numeric" })}`;
  }

  const [y, m] = anchor.split("-").map(Number);
  return lang === "ar"
    ? `${AR_MONTHS[m - 1]} ${y}`
    : fmt(anchor, { month: "long", year: "numeric" });
}
