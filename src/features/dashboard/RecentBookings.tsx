"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type BookingStatus =
  | "PENDING" | "CONFIRMED" | "COMPLETED"
  | "CANCELLED" | "NO_SHOW" | "PENDING_PAYMENT" | "FAILED_PAYMENT";

export type RecentBooking = {
  id:            string;
  customerName:  string;
  customerPhone: string;
  serviceName:   string;
  date:          Date;
  startTime:     string;
  status:        BookingStatus;
  totalPrice:    number;
  currency:      string;
};

const STATUS_STYLE: Record<BookingStatus, { bg: string; color: string }> = {
  CONFIRMED:       { bg: "#DCFCE7", color: "#15803D" },
  PENDING:         { bg: "#FEF3C7", color: "#92400E" },
  COMPLETED:       { bg: "#DBEAFE", color: "#1D4ED8" },
  CANCELLED:       { bg: "#FEE2E2", color: "#B91C1C" },
  NO_SHOW:         { bg: "#F1F5F9", color: "#475569" },
  PENDING_PAYMENT: { bg: "#FED7AA", color: "#9A3412" },
  FAILED_PAYMENT:  { bg: "#FEE2E2", color: "#B91C1C" },
};

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Deterministic avatar gradient per customer name initial
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#1D4ED8,#3B82F6)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
  "linear-gradient(135deg,#059669,#34D399)",
  "linear-gradient(135deg,#B45309,#F59E0B)",
  "linear-gradient(135deg,#0E7490,#22D3EE)",
  "linear-gradient(135deg,#9D174D,#F472B6)",
];
function avatarGrad(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

export default function RecentBookings({ bookings }: { bookings: RecentBooking[] }) {
  const { t, lang } = useLanguage();
  const rb      = t.dashboard.recentBookings;
  const bs      = t.dashboard.bookingStatus;
  const months  = lang === "ar" ? AR_MONTHS : EN_MONTHS;
  const locale  = lang === "ar" ? "ar-EG" : "en-US";

  function fmtDate(date: Date, startTime: string) {
    const d = new Date(date);
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} · ${startTime}`;
  }

  return (
    <div
      className="rounded-2xl border bg-white overflow-hidden"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid #F1F5F9" }}
      >
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold text-[#0F172A]">{rb.title}</h3>
          {bookings.length > 0 && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#F1F5F9", color: "#64748B" }}
            >
              {bookings.length}
            </span>
          )}
        </div>
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-1 text-xs font-semibold transition-colors"
          style={{ color: "#3B82F6" }}
        >
          {rb.viewAll ?? "عرض الكل"}
          <ArrowLeft size={12} />
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="py-16 text-center">
          <div
            className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: "#F8FAFC" }}
          >
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-sm font-medium text-[#475569]">{rb.empty}</p>
          <p className="text-xs text-[#94A3B8] mt-1">لا توجد حجوزات حتى الآن</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 560 }}>
            <thead>
              <tr style={{ background: "#FAFBFD", borderBottom: "1px solid #F1F5F9" }}>
                {[rb.columns.customer, rb.columns.service, rb.columns.date, rb.columns.price, rb.columns.status].map((col) => (
                  <th
                    key={col}
                    className="text-start px-5 py-3 text-xs font-semibold"
                    style={{ color: "#94A3B8", letterSpacing: "0.02em" }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const statusStyle = STATUS_STYLE[b.status];
                const statusLabel = (bs as Record<string, string>)[b.status] ?? b.status;
                return (
                  <tr
                    key={b.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid #F8FAFC" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = "#FAFBFD";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                    }}
                  >
                    {/* Customer + avatar */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                          style={{ background: avatarGrad(b.customerName) }}
                        >
                          {b.customerName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A] leading-snug">
                            {b.customerName}
                          </p>
                          <p className="text-xs text-[#94A3B8]" dir="ltr">{b.customerPhone}</p>
                        </div>
                      </div>
                    </td>

                    {/* Service */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[#475569] max-w-[140px] truncate">{b.serviceName}</p>
                    </td>

                    {/* Date + time */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-[#475569] whitespace-nowrap">
                        {fmtDate(b.date, b.startTime)}
                      </p>
                    </td>

                    {/* Price */}
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-bold text-[#0F172A] whitespace-nowrap">
                        {b.totalPrice.toLocaleString(locale)}{" "}
                        <span className="font-normal text-[#94A3B8] text-xs">{b.currency}</span>
                      </p>
                    </td>

                    {/* Status badge */}
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{ background: statusStyle.bg, color: statusStyle.color }}
                      >
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
