"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
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

interface BookingFiltersProps {
  statusFilter:    string;
  onStatusChange:  (s: string) => void;
  search:          string;
  onSearchChange:  (s: string) => void;
  dateFrom:        string;
  dateTo:          string;
  onDateFromChange: (d: string) => void;
  onDateToChange:   (d: string) => void;
  serviceFilter:   string;
  onServiceChange: (id: string) => void;
  services:        Array<{ id: string; nameAr: string }>;
  total:           number;
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
  const [localSearch,  setLocalSearch]  = useState(search);
  const [datePreset,   setDatePreset]   = useState<DatePreset>("all");
  const [showCustom,   setShowCustom]   = useState(false);
  const { t, lang } = useLanguage();
  const bf = t.dashboard.bookingFilters;
  const bs = t.dashboard.bookingStatus;

  const ALL_STATUSES = [
    { value: "ALL",       label: bs.ALL },
    ...STATUS_KEYS.map((k) => ({ value: k, label: (bs as Record<string, string>)[k] ?? STATUS_CONFIG[k].label })),
  ];

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => onSearchChange(localSearch), 350);
    return () => clearTimeout(t);
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
    // "custom" keeps whatever from/to the user typed
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
    <div className="card p-4 space-y-3">
      {/* Status tab pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {ALL_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => onStatusChange(s.value)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              statusFilter === s.value
                ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-brand)]/40"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Search + Service row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute top-1/2 -translate-y-1/2 end-3 text-[var(--color-text-muted)] pointer-events-none"
          />
          <input
            type="text"
            placeholder={bf.searchPlaceholder}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="input pe-9 text-sm"
          />
        </div>

        {services.length > 0 && (
          <select
            value={serviceFilter}
            onChange={(e) => onServiceChange(e.target.value)}
            className="input text-sm min-w-[160px]"
          >
            <option value="">{bf.allServices}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Date preset pills */}
      <div className="flex gap-1.5 flex-wrap">
        {DATE_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
              datePreset === p.key
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30"
                : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)]/30"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range inputs */}
      {showCustom && (
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="input text-sm flex-1"
            placeholder="من"
          />
          <span className="text-[var(--color-text-muted)] text-sm">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="input text-sm flex-1"
            placeholder="إلى"
          />
        </div>
      )}

      {/* Active filter summary */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>{total.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} {bf.results}</span>
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-red-500 hover:text-red-600 font-medium transition-colors"
          >
            <X size={11} />
            {bf.clearFilters}
          </button>
        </div>
      )}
    </div>
  );
}
