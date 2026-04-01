"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ChevronDown, ChevronUp, Users } from "lucide-react";
import CustomerDetailPanel from "./CustomerDetailPanel";
import type { CustomerRow } from "@/app/api/business/customers/route";
import { formatDateAr } from "@/features/dashboard/bookings/types";

type SortKey = "createdAt" | "bookingCount" | "totalSpend" | "lastVisit" | "name";

interface Props {
  initialCustomers: CustomerRow[];
}

export default function CustomersClient({ initialCustomers }: Props) {
  const [customers,  setCustomers]  = useState<CustomerRow[]>(initialCustomers);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortKey,    setSortKey]    = useState<SortKey>("createdAt");
  const [sortOrder,  setSortOrder]  = useState<"asc" | "desc">("desc");
  const [selected,   setSelected]   = useState<CustomerRow | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort:  sortKey,
        order: sortOrder,
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

      const res  = await fetch(`/api/business/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sortKey, sortOrder]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  }

  function handleNotesSaved(id: string, notes: string | null) {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, notes } : c))
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, notes } : prev));
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronDown size={12} className="text-[var(--color-text-muted)] opacity-40" />;
    return sortOrder === "asc"
      ? <ChevronUp size={12} className="text-[var(--color-brand)]" />
      : <ChevronDown size={12} className="text-[var(--color-brand)]" />;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">العملاء</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {customers.length.toLocaleString("ar-EG")} عميل مسجل
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 end-3 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            className="input pe-9 text-sm w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                {/* Name */}
                <th className="text-start px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)]">
                  <button
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    العميل <SortIcon k="name" />
                  </button>
                </th>

                {/* Phone */}
                <th className="text-start px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)]">
                  الهاتف
                </th>

                {/* Booking count */}
                <th className="text-start px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)]">
                  <button
                    onClick={() => toggleSort("bookingCount")}
                    className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    الحجوزات <SortIcon k="bookingCount" />
                  </button>
                </th>

                {/* Last visit */}
                <th className="text-start px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)]">
                  <button
                    onClick={() => toggleSort("lastVisit")}
                    className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    آخر زيارة <SortIcon k="lastVisit" />
                  </button>
                </th>

                {/* Total spend */}
                <th className="text-start px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)]">
                  <button
                    onClick={() => toggleSort("totalSpend")}
                    className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    الإنفاق <SortIcon k="totalSpend" />
                  </button>
                </th>

                {/* Action */}
                <th className="px-5 py-3" />
              </tr>
            </thead>

            <tbody>
              {loading && customers.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-[var(--color-border)] rounded animate-pulse" />
                      </td>
                    ))}
                    <td className="px-5 py-4" />
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
                        <Users size={22} className="text-[var(--color-text-muted)]" />
                      </div>
                      <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                        {search ? "لا يوجد عملاء يطابقون البحث" : "لا يوجد عملاء بعد"}
                      </p>
                      {!search && (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          سيظهر عملاؤك هنا بعد أول حجز
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`border-b border-[var(--color-border)] last:border-0 cursor-pointer transition-colors ${
                      selected?.id === c.id
                        ? "bg-[var(--color-brand)]/5"
                        : "hover:bg-[var(--color-surface-2)]"
                    }`}
                    style={{ opacity: loading ? 0.6 : 1 }}
                  >
                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center text-xs font-bold text-[var(--color-accent)] shrink-0">
                          {c.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{c.name}</p>
                          {c.notes && (
                            <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[180px]">
                              📝 {c.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[var(--color-text-secondary)]" dir="ltr">{c.phone}</p>
                    </td>

                    {/* Booking count */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-primary)] px-2.5 py-1 rounded-full border border-[var(--color-border)]">
                        {c.bookingCount.toLocaleString("ar-EG")} حجز
                      </span>
                    </td>

                    {/* Last visit */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {c.lastBookingDate ? formatDateAr(c.lastBookingDate) : "—"}
                      </p>
                    </td>

                    {/* Total spend */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-bold text-[var(--color-accent)]">
                        {c.totalSpend.toLocaleString("ar-EG")}{" "}
                        <span className="font-normal text-[var(--color-text-muted)] text-xs">{c.currency}</span>
                      </p>
                    </td>

                    {/* Arrow */}
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-[var(--color-text-muted)]">تفاصيل</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
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
