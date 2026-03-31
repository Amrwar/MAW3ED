"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { type DashboardBookingStatus, STATUS_CONFIG } from "@/features/dashboard/bookings/types";

const ALL_STATUSES: Array<{ value: string; label: string }> = [
  { value: "ALL",       label: "\u0627\u0644\u0643\u0644" },
  { value: "PENDING",   label: STATUS_CONFIG.PENDING.label   },
  { value: "CONFIRMED", label: STATUS_CONFIG.CONFIRMED.label },
  { value: "COMPLETED", label: STATUS_CONFIG.COMPLETED.label },
  { value: "CANCELLED", label: STATUS_CONFIG.CANCELLED.label },
  { value: "NO_SHOW",   label: STATUS_CONFIG.NO_SHOW.label   },
];

interface BookingFiltersProps {
  statusFilter:    string;
  onStatusChange:  (s: string) => void;
  search:          string;
  onSearchChange:  (s: string) => void;
  dateFilter:      string;
  onDateChange:    (d: string) => void;
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
  dateFilter,
  onDateChange,
  serviceFilter,
  onServiceChange,
  services,
  total,
}: BookingFiltersProps) {
  // Debounce search locally
  const [localSearch, setLocalSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => onSearchChange(localSearch), 350);
    return () => clearTimeout(t);
  }, [localSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActiveFilters =
    statusFilter !== "ALL" || localSearch || dateFilter || serviceFilter;

  function clearAll() {
    setLocalSearch("");
    onSearchChange("");
    onStatusChange("ALL");
    onDateChange("");
    onServiceChange("");
  }

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

      {/* Search + Service + Date row */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute top-1/2 -translate-y-1/2 end-3 text-[var(--color-text-muted)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="\u0628\u062d\u062b \u0628\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064a\u0644 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641\u2026"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="input pe-9 text-sm"
          />
        </div>

        {/* Service filter */}
        {services.length > 0 && (
          <select
            value={serviceFilter}
            onChange={(e) => onServiceChange(e.target.value)}
            className="input text-sm min-w-[160px]"
          >
            <option value="">\u0643\u0644 \u0627\u0644\u062e\u062f\u0645\u0627\u062a</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nameAr}
              </option>
            ))}
          </select>
        )}

        {/* Date filter */}
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => onDateChange(e.target.value)}
          className="input text-sm min-w-[150px]"
        />
      </div>

      {/* Active filter summary */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>
            {total} \u0646\u062a\u064a\u062c\u0629
          </span>
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-red-500 hover:text-red-600 font-medium transition-colors"
          >
            <X size={11} />
            \u0645\u0633\u062d \u0627\u0644\u0641\u0644\u0627\u062a\u0631
          </button>
        </div>
      )}
    </div>
  );
}
