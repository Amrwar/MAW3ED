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
  ALL:       { bg: "#F8FAFC", color: "#64748B", activeBg: "#0F172A",  activeColor: "#FFFFFF" },
  PENDING:   { bg: "#FEF3C7", color: "#92400E", activeBg: "#D97706",  activeColor: "#FFFFFF" },
  CONFIRMED: { bg: "#DCFCE7", color: "#15803D", activeBg: "#16A34A",  activeColor: "#FFFFFF" },
  COMPLETED: { bg: "#DBEAFE", color: "#1D4ED8", activeBg: "#1D4ED8",  activeColor: "#FFFFFF" },
  CANCELLED: { bg: "#FEE2E2", color: "#B91C1C", activeBg: "#DC2626",  activeColor: "#FFFFFF" },
  NO_SHOW:   { bg: "#F1F5F9", color: "#475569", activeBg: "#475569",  activeColor: "#FFFFFF" },
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
  const locale = lang === "ar" ? "ar-EG" : "en-US";

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
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
    >
      {/* Row 1 — section label + clear */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} strokeWidth={1.75} style={{ color: "#3B82F6" }} />
          <span className="text-sm font-bold text-[#0F172A]">تصفية الحجوزات</span>
          {hasActiveFilters && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#DBEAFE", color: "#1D4ED8" }}
            >
              نشط
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-xs font-semibold transition-colors"
            style={{ color: "#EF4444" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#DC2626"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
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
                borderColor:  isActive ? pill.activeBg   : "#E2E8F0",
                boxShadow:    isActive ? "0 2px 8px rgba(15,23,42,0.12)" : "none",
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
            style={{ insetInlineEnd: 12, color: "#94A3B8" }}
          />
          <input
            type="text"
            placeholder={bf.searchPlaceholder}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full rounded-xl border text-sm outline-none transition-all duration-150"
            style={{
              borderColor: "#E2E8F0",
              background:  "#F8FAFC",
              color:       "#0F172A",
              paddingBlock: 9,
              paddingInline: "12px 38px",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3B82F6";
              e.currentTarget.style.background   = "#FFFFFF";
              e.currentTarget.style.boxShadow    = "0 0 0 3px rgba(59,130,246,0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#E2E8F0";
              e.currentTarget.style.background   = "#F8FAFC";
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
              borderColor:  "#E2E8F0",
              background:   "#F8FAFC",
              color:        "#475569",
              paddingBlock: 9,
              paddingInline: 12,
              minWidth:     160,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3B82F6";
              e.currentTarget.style.background   = "#FFFFFF";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#E2E8F0";
              e.currentTarget.style.background   = "#F8FAFC";
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
                background:  isActive ? "#EFF6FF" : "#F8FAFC",
                color:       isActive ? "#1D4ED8"  : "#64748B",
                borderColor: isActive ? "#BFDBFE"  : "#E2E8F0",
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
              borderColor:  "#E2E8F0",
              background:   "#F8FAFC",
              color:        "#0F172A",
              paddingBlock: 9,
              paddingInline: 12,
            }}
          />
          <span className="text-sm font-bold text-[#CBD5E1]">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="flex-1 rounded-xl border text-sm outline-none"
            style={{
              borderColor:  "#E2E8F0",
              background:   "#F8FAFC",
              color:        "#0F172A",
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
          style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
        >
          <span className="text-xs text-[#94A3B8]">{bf.results}:</span>
          <span className="text-xs font-bold text-[#0F172A]">
            {total.toLocaleString(locale)}
          </span>
          <span className="text-xs text-[#94A3B8]">حجز</span>
        </div>
      )}
    </div>
  );
}
