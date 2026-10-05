"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search, ChevronDown, ChevronUp, Users,
  UsersRound, CalendarDays, Wallet,
  Eye, ChevronLeft,
} from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { cn } from "@/lib/utils";
import CustomerDetailPanel from "./CustomerDetailPanel";
import type { CustomerRow } from "@/app/api/business/customers/route";
import { formatDateAr } from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";

type SortKey = "createdAt" | "bookingCount" | "totalSpend" | "lastVisit" | "name";

// Deterministic avatar gradient
const GRADIENTS = [
  "linear-gradient(135deg,var(--color-jade),var(--color-jade))",
  "linear-gradient(135deg,var(--color-jade),var(--color-jade-line))",
  "linear-gradient(135deg,var(--color-ok),var(--color-jade))",
  "linear-gradient(135deg,var(--color-warn),var(--color-star))",
  "linear-gradient(135deg,var(--color-info),var(--color-info))",
  "linear-gradient(135deg,var(--color-jade-hover),var(--color-jade-line))",
  "linear-gradient(135deg,var(--color-danger),var(--color-danger))",
  "linear-gradient(135deg,var(--color-jade-hover),var(--color-jade-line))",
];
function custGrad(name: string) {
  return GRADIENTS[(name.charCodeAt(0) || 0) % GRADIENTS.length];
}

function customerLabel(c: CustomerRow): { text: string; bg: string; color: string } {
  if (c.bookingCount === 0)  return { text: "جديد",         bg: "var(--color-surface-3)", color: "var(--color-muted)" };
  if (c.bookingCount >= 5)   return { text: "عميل مميز ⭐", bg: "var(--color-warn-soft)", color: "var(--color-warn)" };
  return { text: "عميل دائم", bg: "var(--color-ok-soft)", color: "var(--color-ok)" };
}

function customerStatus(c: CustomerRow): { text: string; bg: string; color: string } {
  if (!c.lastBookingDate)    return { text: "غير نشط", bg: "var(--color-surface-3)", color: "var(--color-subtle)" };
  const diffDays = (Date.now() - new Date(c.lastBookingDate).getTime()) / 86_400_000;
  if (diffDays <= 90)        return { text: "نشط",     bg: "var(--color-ok-soft)", color: "var(--color-ok)" };
  return { text: "غير نشط", bg: "var(--color-surface-3)", color: "var(--color-subtle)" };
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
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";

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

  /**
   * A sortable column. aria-sort belongs on the header cell, not the
   * button inside it, so the cell and its control are one component.
   */
  const SortTH = ({ k, children }: { k: SortKey; children: React.ReactNode }) => {
    const active = sortKey === k;
    const Icon = active && sortOrder === "asc" ? ChevronUp : ChevronDown;
    return (
      <TH aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={cn(
            "-mx-2 flex min-h-11 items-center gap-1 rounded-[var(--radius-sm)] px-2 transition-colors",
            active ? "text-[var(--color-jade)]" : "hover:text-[var(--color-muted)]",
          )}
        >
          {children}
          <Icon
            size={11}
            aria-hidden="true"
            className={active ? "text-[var(--color-jade)]" : "text-[var(--color-line-2)]"}
          />
        </button>
      </TH>
    );
  };

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              className="m-0 text-[1.75rem] font-light tracking-tight text-[var(--color-ink)]"
            >
              {cu.title}
            </h1>
            <p className="text-sm text-[var(--color-subtle)] mt-1">
              إدارة العملاء وسجل الحجوزات والتفاعل ·{" "}
              <span className="font-semibold text-[var(--color-muted)]">
                {customers.length.toLocaleString(locale)} {cu.countSuffix}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Users size={16} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />}
          iconBg="var(--color-jade-tint)"
          value={customers.length.toLocaleString(locale)}
          label="إجمالي العملاء"
          sub="مسجلون في النظام"
        />
        <SummaryCard
          icon={<UsersRound size={16} strokeWidth={1.75} style={{ color: "var(--color-ok)" }} />}
          iconBg="var(--color-ok-soft)"
          value={activeCount.toLocaleString(locale)}
          label="العملاء النشطون"
          sub="آخر 90 يوماً"
        />
        <SummaryCard
          icon={<CalendarDays size={16} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />}
          iconBg="var(--color-jade-tint)"
          value={newThisMonth.toLocaleString(locale)}
          label="جدد هذا الشهر"
          sub="عميل جديد"
        />
        <SummaryCard
          icon={<Wallet size={16} strokeWidth={1.75} style={{ color: "var(--color-warn)" }} />}
          iconBg="var(--color-warn-soft)"
          value={customers.length > 0 ? avgSpend.toLocaleString(locale) : "—"}
          label="متوسط الإنفاق"
          sub={currency}
        />
      </div>

      {/* ── Search + sort chips ── */}
      <div
        className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4"
      >
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search
              size={14}
              className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ insetInlineEnd: 12, color: "var(--color-subtle)" }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={cu.searchPlaceholder}
              className="w-full rounded-[var(--radius-md)] border text-sm outline-none transition-all"
              style={{
                borderColor:   "var(--color-line)",
                background:    "var(--color-surface-2)",
                color:         "var(--color-ink)",
                paddingBlock:  9,
                paddingInline: "12px 38px",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-jade)";
                e.currentTarget.style.background  = "var(--color-surface)";
                e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(14,127,94,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--color-line)";
                e.currentTarget.style.background  = "var(--color-surface-2)";
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
                  className="text-xs font-medium px-3.5 py-2 rounded-[var(--radius-md)] border transition-all duration-150"
                  style={{
                    background:  isActive ? "var(--color-ink)"  : "var(--color-surface-2)",
                    color:       isActive ? "var(--color-surface)"   : "var(--color-muted)",
                    borderColor: isActive ? "var(--color-ink)"   : "var(--color-line)",
                    fontWeight:  isActive ? 700 : 500,
                    boxShadow:   isActive ? "0 2px 8px rgba(17,32,28,0.15)" : "none",
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
        className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] overflow-hidden"
      >
        {/* Table header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-surface-3)" }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold text-[var(--color-ink)]">قائمة العملاء</h2>
            {!loading && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--color-surface-3)", color: "var(--color-muted)" }}
              >
                {customers.length}
              </span>
            )}
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-subtle)]">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--color-jade)] border-t-transparent animate-spin" />
              جاري التحديث
            </div>
          )}
        </div>

        <Table minWidth="46.25rem">

          <THead>
            <TR>
              <SortTH k="name">{cu.columns.customer}</SortTH>
              <TH>{cu.columns.phone}</TH>
              <SortTH k="bookingCount">{cu.columns.bookings}</SortTH>
              <SortTH k="lastVisit">{cu.columns.lastVisit}</SortTH>
              <SortTH k="totalSpend">{cu.columns.spend}</SortTH>
              <TH>الحالة</TH>
              <TH>
                <span className="sr-only">تفاصيل</span>
              </TH>
            </TR>
          </THead>

          <TBody>
              {/* Loading skeleton */}
              {loading && customers.length === 0
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TR key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TD key={j}>
                          <div
                            className="h-3.5 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-3)]"
                            style={{ width: j === 0 ? 140 : j === 6 ? 40 : 80 }}
                          />
                        </TD>
                      ))}
                    </TR>
                  ))

                /* Empty */
                : customers.length === 0 ? (
                  <TR>
                    <TD colSpan={7} className="px-5 py-20 text-center">
                      <div
                        className="w-16 h-16 rounded-[var(--radius-lg)] mx-auto mb-4 flex items-center justify-center"
                        style={{ background: "var(--color-surface-2)" }}
                      >
                        <Users size={26} strokeWidth={1.5} style={{ color: "var(--color-subtle)" }} />
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-muted)]">
                        {search ? cu.emptySearch : cu.emptyTitle}
                      </p>
                      {!search && (
                        <p className="text-xs text-[var(--color-subtle)] mt-1">{cu.emptySub}</p>
                      )}
                    </TD>
                  </TR>

                /* Rows */
                ) : (
                  customers.map((c) => {
                    const label  = customerLabel(c);
                    const status = customerStatus(c);
                    const isSelected = selected?.id === c.id;

                    return (
                      <TR
                        key={c.id}
                        selected={isSelected}
                        onClick={() => setSelected(c)}
                        className={loading ? "opacity-60" : undefined}
                      >
                        {/* Customer */}
                        <TD>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold text-white shrink-0"
                              style={{ background: custGrad(c.name) }}
                            >
                              {c.name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[var(--color-ink)] leading-snug truncate">{c.name}</p>
                              <span
                                className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5"
                                style={{ background: label.bg, color: label.color }}
                              >
                                {label.text}
                              </span>
                            </div>
                          </div>
                        </TD>

                        {/* Phone */}
                        <TD>
                          <p className="text-sm text-[var(--color-muted)]" dir="ltr">{c.phone}</p>
                        </TD>

                        {/* Booking count */}
                        <TD>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="text-sm font-bold"
                              style={{ color: c.bookingCount > 0 ? "var(--color-ink)" : "var(--color-subtle)" }}
                            >
                              {c.bookingCount.toLocaleString(locale)}
                            </span>
                            <span className="text-xs text-[var(--color-subtle)]">{cu.bookingCount}</span>
                          </div>
                        </TD>

                        {/* Last visit */}
                        <TD>
                          <p className="text-sm text-[var(--color-muted)] whitespace-nowrap">
                            {c.lastBookingDate ? formatDateAr(c.lastBookingDate) : (
                              <span className="text-[var(--color-line-2)]">—</span>
                            )}
                          </p>
                        </TD>

                        {/* Total spend */}
                        <TD>
                          <p className="text-sm font-extrabold whitespace-nowrap" style={{ color: c.totalSpend > 0 ? "var(--color-jade)" : "var(--color-subtle)" }}>
                            {c.totalSpend.toLocaleString(locale)}
                            <span className="text-xs font-normal text-[var(--color-subtle)] ms-1">{c.currency}</span>
                          </p>
                        </TD>

                        {/* Status */}
                        <TD>
                          <span
                            className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                            style={{ background: status.bg, color: status.color }}
                          >
                            {status.text}
                          </span>
                        </TD>

                        {/* Action */}
                        <TD>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(c); }}
                            className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center transition-all duration-150"
                            style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
                          >
                            <Eye size={13} strokeWidth={1.75} />
                          </button>
                        </TD>
                      </TR>
                    );
                  })
                )}
          </TBody>
        </Table>

        {/* Table footer */}
        {customers.length > 0 && !loading && (
          <div
            className="px-6 py-3 flex items-center justify-between"
            style={{ borderTop: "1px solid var(--color-surface-3)" }}
          >
            <p className="text-xs text-[var(--color-subtle)]">
              عرض{" "}
              <span className="font-bold text-[var(--color-muted)]">{customers.length}</span>{" "}
              عميل
            </p>
            <p className="text-xs text-[var(--color-subtle)] flex items-center gap-1">
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
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
    >
      <div
        className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center mb-3"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
      <p
        className="font-extrabold text-[var(--color-ink)] leading-none text-[1.5rem]"
        style={{ letterSpacing: "-0.02em" }}
      >
        {value}
      </p>
      <p className="text-xs font-semibold text-[var(--color-muted)] mt-1">{label}</p>
      {sub && <p className="text-[11px] text-[var(--color-subtle)] mt-0.5">{sub}</p>}
    </div>
  );
}
