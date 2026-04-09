"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, ChevronDown, ChevronUp, Users,
  UsersRound, TrendingUp, CalendarDays, Wallet,
  Eye, ChevronLeft,
} from "lucide-react";
import CustomerDetailPanel from "./CustomerDetailPanel";
import type { CustomerRow } from "@/app/api/business/customers/route";
import { formatDateAr } from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";

type SortKey = "createdAt" | "bookingCount" | "totalSpend" | "lastVisit" | "name";

// Deterministic avatar gradient
const GRADIENTS = [
  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  "linear-gradient(135deg,#059669,#34D399)",
  "linear-gradient(135deg,#B45309,#F59E0B)",
  "linear-gradient(135deg,#0E7490,#22D3EE)",
  "linear-gradient(135deg,#9D174D,#F472B6)",
  "linear-gradient(135deg,#DC2626,#F87171)",
  "linear-gradient(135deg,#4338CA,#818CF8)",
];
function custGrad(name: string) {
  return GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length];
}

function customerLabel(c: CustomerRow): { text: string; bg: string; color: string } {
  if (c.bookingCount === 0)  return { text: "جديد",         bg: "#F1F5F9", color: "#64748B" };
  if (c.bookingCount >= 5)   return { text: "عميل مميز ⭐", bg: "#FEF3C7", color: "#92400E" };
  return { text: "عميل دائم", bg: "#DCFCE7", color: "#15803D" };
}

function customerStatus(c: CustomerRow): { text: string; bg: string; color: string } {
  if (!c.lastBookingDate)    return { text: "غير نشط", bg: "#F1F5F9", color: "#94A3B8" };
  const diffDays = (Date.now() - new Date(c.lastBookingDate).getTime()) / 86_400_000;
  if (diffDays <= 90)        return { text: "نشط",     bg: "#DCFCE7", color: "#15803D" };
  return { text: "غير نشط", bg: "#F1F5F9", color: "#94A3B8" };
}

interface Props {
  initialCustomers: CustomerRow[];
}

const SORT_CHIPS: Array<{ key: SortKey; order: "asc" | "desc"; label: string }> = [
  { key: "createdAt",   order: "desc", label: "الكل" },
  { key: "bookingCount",order: "desc", label: "الأكثر حجزاً" },
  { key: "totalSpend",  order: "desc", label: "الأعلى إنفاقاً" },
  { key: "lastVisit",   order: "desc", label: "آخر زيارة" },
];

export default function CustomersClient({ initialCustomers }: Props) {
  const [customers,       setCustomers]       = useState<CustomerRow[]>(initialCustomers);
  const [loading,         setLoading]         = useState(false);
  const [search,          setSearch]          = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey,         setSortKey]         = useState<SortKey>("createdAt");
  const [sortOrder,       setSortOrder]       = useState<"asc" | "desc">("desc");
  const [selected,        setSelected]        = useState<CustomerRow | null>(null);
  const [activeChip,      setActiveChip]      = useState(0);

  const { t, lang } = useLanguage();
  const cu     = t.dashboard.customers;
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: sortKey, order: sortOrder });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const res  = await fetch(`/api/business/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } catch { /* keep previous */ } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sortKey, sortOrder]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  function applyChip(idx: number) {
    const chip = SORT_CHIPS[idx];
    setActiveChip(idx);
    setSortKey(chip.key);
    setSortOrder(chip.order);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
    setActiveChip(-1); // deselect chip when using column header
  }

  function handleNotesSaved(id: string, notes: string | null) {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, notes } : c)));
    setSelected((prev) => (prev?.id === id ? { ...prev, notes } : prev));
  }

  // Derived stats
  const now              = Date.now();
  const startOfMonth     = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const activeCount      = customers.filter((c) => {
    if (!c.lastBookingDate) return false;
    return (now - new Date(c.lastBookingDate).getTime()) / 86_400_000 <= 90;
  }).length;
  const newThisMonth     = customers.filter((c) => new Date(c.createdAt).getTime() >= startOfMonth).length;
  const avgSpend         = customers.length
    ? Math.round(customers.reduce((a, c) => a + c.totalSpend, 0) / customers.length)
    : 0;
  const currency         = customers[0]?.currency ?? "EGP";

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k)     return <ChevronDown size={11} style={{ color: "#CBD5E1" }} />;
    return sortOrder === "asc"
      ? <ChevronUp   size={11} style={{ color: "#3B82F6" }} />
      : <ChevronDown size={11} style={{ color: "#3B82F6" }} />;
  };

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div
        className="rounded-2xl border bg-white px-6 py-5"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              className="font-black text-[#0F172A] leading-tight"
              style={{ fontSize: 22, letterSpacing: "-0.02em" }}
            >
              {cu.title}
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1">
              إدارة العملاء وسجل الحجوزات والتفاعل ·{" "}
              <span className="font-semibold text-[#475569]">
                {customers.length.toLocaleString(locale)} {cu.countSuffix}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Users size={16} strokeWidth={1.75} style={{ color: "#1D4ED8" }} />}
          iconBg="#EFF6FF"
          value={customers.length.toLocaleString(locale)}
          label="إجمالي العملاء"
          sub="مسجلون في النظام"
        />
        <SummaryCard
          icon={<UsersRound size={16} strokeWidth={1.75} style={{ color: "#059669" }} />}
          iconBg="#F0FDF4"
          value={activeCount.toLocaleString(locale)}
          label="العملاء النشطون"
          sub="آخر 90 يوماً"
        />
        <SummaryCard
          icon={<CalendarDays size={16} strokeWidth={1.75} style={{ color: "#7C3AED" }} />}
          iconBg="#F5F3FF"
          value={newThisMonth.toLocaleString(locale)}
          label="جدد هذا الشهر"
          sub="عميل جديد"
        />
        <SummaryCard
          icon={<Wallet size={16} strokeWidth={1.75} style={{ color: "#B45309" }} />}
          iconBg="#FFFBEB"
          value={customers.length > 0 ? avgSpend.toLocaleString(locale) : "—"}
          label="متوسط الإنفاق"
          sub={currency}
        />
      </div>

      {/* ── Search + sort chips ── */}
      <div
        className="rounded-2xl border bg-white px-5 py-4"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
      >
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search
              size={14}
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ insetInlineEnd: 12, color: "#94A3B8" }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={cu.searchPlaceholder}
              className="w-full rounded-xl border text-sm outline-none transition-all"
              style={{
                borderColor:   "#E2E8F0",
                background:    "#F8FAFC",
                color:         "#0F172A",
                paddingBlock:  9,
                paddingInline: "12px 38px",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3B82F6";
                e.currentTarget.style.background  = "#FFFFFF";
                e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(59,130,246,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
                e.currentTarget.style.background  = "#F8FAFC";
                e.currentTarget.style.boxShadow   = "none";
              }}
            />
          </div>

          {/* Sort chips */}
          <div className="flex gap-2 flex-wrap">
            {SORT_CHIPS.map((chip, idx) => {
              const isActive = activeChip === idx;
              return (
                <button
                  key={chip.key}
                  onClick={() => applyChip(idx)}
                  className="text-xs font-medium px-3.5 py-2 rounded-xl border transition-all duration-150"
                  style={{
                    background:  isActive ? "#0F172A"  : "#F8FAFC",
                    color:       isActive ? "#FFFFFF"   : "#64748B",
                    borderColor: isActive ? "#0F172A"   : "#E2E8F0",
                    fontWeight:  isActive ? 700 : 500,
                    boxShadow:   isActive ? "0 2px 8px rgba(15,23,42,0.15)" : "none",
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Customers table ── */}
      <div
        className="rounded-2xl border bg-white overflow-hidden"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
      >
        {/* Table header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-[#0F172A]">قائمة العملاء</h2>
            {!loading && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#F1F5F9", color: "#64748B" }}
              >
                {customers.length}
              </span>
            )}
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <div className="w-3 h-3 rounded-full border-2 border-[#3B82F6] border-t-transparent animate-spin" />
              جاري التحديث
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 740 }}>
            <thead>
              <tr style={{ background: "#FAFBFD", borderBottom: "1px solid #F1F5F9" }}>
                {/* Customer */}
                <th className="text-start px-6 py-3">
                  <button
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors"
                    style={{ color: sortKey === "name" ? "#1D4ED8" : "#94A3B8", letterSpacing: "0.02em" }}
                  >
                    {cu.columns.customer}
                    <SortIcon k="name" />
                  </button>
                </th>
                {/* Phone */}
                <th
                  className="text-start px-5 py-3 text-xs font-semibold"
                  style={{ color: "#94A3B8", letterSpacing: "0.02em" }}
                >
                  {cu.columns.phone}
                </th>
                {/* Bookings */}
                <th className="text-start px-5 py-3">
                  <button
                    onClick={() => toggleSort("bookingCount")}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors"
                    style={{ color: sortKey === "bookingCount" ? "#1D4ED8" : "#94A3B8", letterSpacing: "0.02em" }}
                  >
                    {cu.columns.bookings}
                    <SortIcon k="bookingCount" />
                  </button>
                </th>
                {/* Last visit */}
                <th className="text-start px-5 py-3">
                  <button
                    onClick={() => toggleSort("lastVisit")}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors"
                    style={{ color: sortKey === "lastVisit" ? "#1D4ED8" : "#94A3B8", letterSpacing: "0.02em" }}
                  >
                    {cu.columns.lastVisit}
                    <SortIcon k="lastVisit" />
                  </button>
                </th>
                {/* Spend */}
                <th className="text-start px-5 py-3">
                  <button
                    onClick={() => toggleSort("totalSpend")}
                    className="flex items-center gap-1 text-xs font-semibold transition-colors"
                    style={{ color: sortKey === "totalSpend" ? "#1D4ED8" : "#94A3B8", letterSpacing: "0.02em" }}
                  >
                    {cu.columns.spend}
                    <SortIcon k="totalSpend" />
                  </button>
                </th>
                {/* Status */}
                <th
                  className="text-start px-5 py-3 text-xs font-semibold"
                  style={{ color: "#94A3B8", letterSpacing: "0.02em" }}
                >
                  الحالة
                </th>
                {/* Actions */}
                <th className="px-5 py-3" />
              </tr>
            </thead>

            <tbody>
              {/* Loading skeleton */}
              {loading && customers.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F8FAFC" }}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div
                            className="rounded-lg animate-pulse"
                            style={{
                              height:     14,
                              background: "#F1F5F9",
                              width:      j === 0 ? 140 : j === 6 ? 40 : 80,
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))

                /* Empty */
                : customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-20 text-center">
                      <div
                        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ background: "#F8FAFC" }}
                      >
                        <Users size={26} strokeWidth={1.5} style={{ color: "#94A3B8" }} />
                      </div>
                      <p className="text-sm font-semibold text-[#475569]">
                        {search ? cu.emptySearch : cu.emptyTitle}
                      </p>
                      {!search && (
                        <p className="text-xs text-[#94A3B8] mt-1">{cu.emptySub}</p>
                      )}
                    </td>
                  </tr>

                /* Rows */
                ) : (
                  customers.map((c) => {
                    const label  = customerLabel(c);
                    const status = customerStatus(c);
                    const isSelected = selected?.id === c.id;

                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className="cursor-pointer transition-colors"
                        style={{
                          borderBottom: "1px solid #F8FAFC",
                          opacity:      loading ? 0.6 : 1,
                          background:   isSelected ? "rgba(59,130,246,0.04)" : "transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected)
                            (e.currentTarget as HTMLTableRowElement).style.background = "#FAFBFD";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background =
                            isSelected ? "rgba(59,130,246,0.04)" : "transparent";
                        }}
                      >
                        {/* Customer */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                              style={{ background: custGrad(c.name) }}
                            >
                              {c.name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#0F172A] leading-snug truncate">{c.name}</p>
                              <span
                                className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5"
                                style={{ background: label.bg, color: label.color }}
                              >
                                {label.text}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-5 py-4">
                          <p className="text-sm text-[#475569]" dir="ltr">{c.phone}</p>
                        </td>

                        {/* Booking count */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-sm font-bold"
                              style={{ color: c.bookingCount > 0 ? "#0F172A" : "#94A3B8" }}
                            >
                              {c.bookingCount.toLocaleString(locale)}
                            </span>
                            <span className="text-xs text-[#94A3B8]">{cu.bookingCount}</span>
                          </div>
                        </td>

                        {/* Last visit */}
                        <td className="px-5 py-4">
                          <p className="text-sm text-[#475569] whitespace-nowrap">
                            {c.lastBookingDate ? formatDateAr(c.lastBookingDate) : (
                              <span className="text-[#CBD5E1]">—</span>
                            )}
                          </p>
                        </td>

                        {/* Total spend */}
                        <td className="px-5 py-4">
                          <p className="text-sm font-black whitespace-nowrap" style={{ color: c.totalSpend > 0 ? "#1D4ED8" : "#94A3B8" }}>
                            {c.totalSpend.toLocaleString(locale)}
                            <span className="text-xs font-normal text-[#94A3B8] ms-1">{c.currency}</span>
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                            style={{ background: status.bg, color: status.color }}
                          >
                            {status.text}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-5 py-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(c); }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150"
                            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#475569" }}
                            onMouseEnter={(e) => {
                              const el = e.currentTarget as HTMLButtonElement;
                              el.style.background  = "#EFF6FF";
                              el.style.borderColor = "#BFDBFE";
                              el.style.color       = "#1D4ED8";
                            }}
                            onMouseLeave={(e) => {
                              const el = e.currentTarget as HTMLButtonElement;
                              el.style.background  = "#F8FAFC";
                              el.style.borderColor = "#E2E8F0";
                              el.style.color       = "#475569";
                            }}
                          >
                            <Eye size={13} strokeWidth={1.75} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {customers.length > 0 && !loading && (
          <div
            className="px-6 py-3 flex items-center justify-between"
            style={{ borderTop: "1px solid #F1F5F9" }}
          >
            <p className="text-xs text-[#94A3B8]">
              عرض{" "}
              <span className="font-bold text-[#475569]">{customers.length}</span>{" "}
              عميل
            </p>
            <p className="text-xs text-[#94A3B8] flex items-center gap-1">
              اضغط على أي صف لعرض التفاصيل
              <ChevronLeft size={12} />
            </p>
          </div>
        )}
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <CustomerDetailPanel
          customer={selected}
          onClose={() => setSelected(null)}
          onNotesSaved={handleNotesSaved}
        />
      )}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon, iconBg, value, label, sub,
}: {
  icon:   React.ReactNode;
  iconBg: string;
  value:  string;
  label:  string;
  sub?:   string;
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <p
        className="font-black text-[#0F172A] leading-none"
        style={{ fontSize: 24, letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-[#475569] mt-1">{label}</p>
      {sub && <p className="text-[11px] text-[#94A3B8] mt-0.5">{sub}</p>}
    </div>
  );
}
