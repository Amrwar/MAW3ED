"use client";

import { useState, useEffect } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { type DashboardBookingStatus, STATUS_CONFIG } from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";

const STATUS_KEYS: DashboardBookingStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

function todayISO() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

type DatePreset = "all" | "today" | "upcoming" | "past" | "custom";

const STATUS_PILL: Record<string, { bg: string; color: string; activeBg: string; activeColor: string }> = {
  ALL:       { bg: "var(--color-surface-2)", color: "var(--color-muted)", activeBg: "var(--color-ink)",  activeColor: "var(--color-surface)" },
  PENDING:   { bg: "var(--color-warn-soft)", color: "var(--color-warn)", activeBg: "var(--color-warn)",  activeColor: "var(--color-surface)" },
  CONFIRMED: { bg: "var(--color-ok-soft)", color: "var(--color-ok)", activeBg: "var(--color-ok)",  activeColor: "var(--color-surface)" },
  COMPLETED: { bg: "var(--color-jade-soft)", color: "var(--color-jade)", activeBg: "var(--color-jade)",  activeColor: "var(--color-surface)" },
  CANCELLED: { bg: "var(--color-danger-soft)", color: "var(--color-danger)", activeBg: "var(--color-danger)",  activeColor: "var(--color-surface)" },
  NO_SHOW:   { bg: "var(--color-surface-3)", color: "var(--color-muted)", activeBg: "var(--color-muted)",  activeColor: "var(--color-surface)" },
};

interface BookingFiltersProps {
  statusFilter:     string;
  onStatusChange:   (s: string) => void;
  search:           string;
  onSearchChange:   (s: string) => void;
  dateFrom:         string;
  dateTo:           string;
  onDateFromChange: (d: string) => void;
  onDateToChange:   (d: string) => void;
  serviceFilter:    string;
  onServiceChange:  (id: string) => void;
  services:         Array<{ id: string; nameAr: string }>;
  total:            number;
}

export default function BookingFilters({
  statusFilter,
  onStatusChange,
  search,
  onSearchChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  serviceFilter,
  onServiceChange,
  services,
  total,
}: BookingFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [datePreset,  setDatePreset]  = useState<DatePreset>("all");
  const [showCustom,  setShowCustom]  = useState(false);
  const { t, lang } = useLanguage();
  const bf     = t.dashboard.bookingFilters;
  const bs     = t.dashboard.bookingStatus;
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

  const ALL_STATUSES = [
    { value: "ALL",       label: bs.ALL },
    ...STATUS_KEYS.map((k) => ({ value: k, label: (bs as Record<string, string>)[k] ?? STATUS_CONFIG[k].label })),
  ];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => onSearchChange(localSearch), 350);
    return () => clearTimeout(timer);
  }, [localSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(preset: DatePreset) {
    setDatePreset(preset);
    setShowCustom(preset === "custom");
    if (preset === "all") {
      onDateFromChange(""); onDateToChange("");
    } else if (preset === "today") {
      const t = todayISO();
      onDateFromChange(t); onDateToChange(t);
    } else if (preset === "upcoming") {
      onDateFromChange(todayISO()); onDateToChange("");
    } else if (preset === "past") {
      onDateFromChange(""); onDateToChange(yesterdayISO());
    }
  }

  const hasActiveFilters =
    statusFilter !== "ALL" || localSearch || dateFrom || dateTo || serviceFilter;

  function clearAll() {
    setLocalSearch("");
    onSearchChange("");
    onStatusChange("ALL");
    onDateFromChange("");
    onDateToChange("");
    onServiceChange("");
    setDatePreset("all");
    setShowCustom(false);
  }

  const DATE_PRESETS: Array<{ key: DatePreset; label: string }> = [
    { key: "all",      label: bf.dateAll },
    { key: "today",    label: bf.dateToday },
    { key: "upcoming", label: bf.dateUpcoming },
    { key: "past",     label: bf.datePast },
    { key: "custom",   label: bf.dateCustom },
  ];

  return (
    <div
      className="rounded-2xl border bg-white p-5 space-y-4"
      style={{ borderColor: "var(--color-line)", boxShadow: "0 1px 8px rgba(17,32,28,0.05)" }}
    >
      {/* Row 1 — section label + clear */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />
          <span className="text-sm font-bold text-[var(--color-ink)]">تصفية الحجوزات</span>
          {hasActiveFilters && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "var(--color-jade-soft)", color: "var(--color-jade)" }}
            >
              نشط
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-xs font-semibold transition-colors transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
            style={{ color: "var(--color-danger)" }}
          >
            <X size={12} />
            {bf.clearFilters}
          </button>
        )}
      </div>

      {/* Row 2 — Status pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
        {ALL_STATUSES.map((s) => {
          const pill    = STATUS_PILL[s.value] ?? STATUS_PILL.ALL;
          const isActive = statusFilter === s.value;
          return (
            <button
              key={s.value}
              onClick={() => onStatusChange(s.value)}
              className="shrink-0 text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all duration-150"
              style={{
                background:   isActive ? pill.activeBg   : pill.bg,
                color:        isActive ? pill.activeColor : pill.color,
                borderColor:  isActive ? pill.activeBg   : "var(--color-line)",
                boxShadow:    isActive ? "0 2px 8px rgba(17,32,28,0.12)" : "none",
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Row 3 — Search + Service dropdown */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ insetInlineEnd: 12, color: "var(--color-subtle)" }}
          />
          <input
            type="text"
            placeholder={bf.searchPlaceholder}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full rounded-xl border text-sm outline-none transition-all duration-150"
            style={{
              borderColor: "var(--color-line)",
              background:  "var(--color-surface-2)",
              color:       "var(--color-ink)",
              paddingBlock: 9,
              paddingInline: "12px 38px",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-jade)";
              e.currentTarget.style.background   = "var(--color-surface)";
              e.currentTarget.style.boxShadow    = "0 0 0 3px rgba(14,127,94,0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-line)";
              e.currentTarget.style.background   = "var(--color-surface-2)";
              e.currentTarget.style.boxShadow    = "none";
            }}
          />
        </div>

        {/* Service filter */}
        {services.length > 0 && (
          <select
            value={serviceFilter}
            onChange={(e) => onServiceChange(e.target.value)}
            className="rounded-xl border text-sm outline-none transition-all duration-150"
            style={{
              borderColor:  "var(--color-line)",
              background:   "var(--color-surface-2)",
              color:        "var(--color-muted)",
              paddingBlock: 9,
              paddingInline: 12,
              minWidth:     160,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--color-jade)";
              e.currentTarget.style.background   = "var(--color-surface)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--color-line)";
              e.currentTarget.style.background   = "var(--color-surface-2)";
            }}
          >
            <option value="">{bf.allServices}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.nameAr}</option>
            ))}
          </select>
        )}
      </div>

      {/* Row 4 — Date preset pills */}
      <div className="flex gap-2 flex-wrap">
        {DATE_PRESETS.map((p) => {
          const isActive = datePreset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className="text-xs font-medium px-3 py-1.5 rounded-xl border transition-all duration-150"
              style={{
                background:  isActive ? "var(--color-jade-tint)" : "var(--color-surface-2)",
                color:       isActive ? "var(--color-jade)"  : "var(--color-muted)",
                borderColor: isActive ? "var(--color-jade-line)"  : "var(--color-line)",
                fontWeight:  isActive ? 600 : 500,
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Row 5 — Custom date range */}
      {showCustom && (
        <div className="flex gap-2.5 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="flex-1 rounded-xl border text-sm outline-none"
            style={{
              borderColor:  "var(--color-line)",
              background:   "var(--color-surface-2)",
              color:        "var(--color-ink)",
              paddingBlock: 9,
              paddingInline: 12,
            }}
          />
          <span className="text-sm font-bold text-[var(--color-line-2)]">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="flex-1 rounded-xl border text-sm outline-none"
            style={{
              borderColor:  "var(--color-line)",
              background:   "var(--color-surface-2)",
              color:        "var(--color-ink)",
              paddingBlock: 9,
              paddingInline: 12,
            }}
          />
        </div>
      )}

      {/* Row 6 — Result count */}
      {hasActiveFilters && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)" }}
        >
          <span className="text-xs text-[var(--color-subtle)]">{bf.results}:</span>
          <span className="text-xs font-bold text-[var(--color-ink)]">
            {total.toLocaleString(locale)}
          </span>
          <span className="text-xs text-[var(--color-subtle)]">حجز</span>
        </div>
      )}
    </div>
  );
}
