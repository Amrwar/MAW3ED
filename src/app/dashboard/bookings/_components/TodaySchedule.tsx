import StatusBadge from "@/features/dashboard/bookings/StatusBadge";
import { type DashboardBooking } from "@/features/dashboard/bookings/types";
import { Clock, Plus } from "lucide-react";

interface TodayScheduleProps {
  bookings:     DashboardBooking[];
  onSelect:     (b: DashboardBooking) => void;
  onNewBooking?: () => void;
}

export default function TodaySchedule({ bookings, onSelect, onNewBooking }: TodayScheduleProps) {
  if (bookings.length === 0) return null;

  const pending   = bookings.filter((b) => b.status === "PENDING").length;
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED").length;

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-[var(--color-brand)]" />
          <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
            \u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u064a\u0648\u0645
          </h3>
          <span className="text-xs font-bold bg-[var(--color-brand)] text-white px-2 py-0.5 rounded-full">
            {bookings.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            {pending > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                {pending} في الانتظار
              </span>
            )}
            {confirmed > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {confirmed} مؤكد
              </span>
            )}
          </div>
          {onNewBooking && (
            <button
              onClick={onNewBooking}
              className="btn btn-outline btn-sm gap-1.5 text-xs"
            >
              <Plus size={13} />
              موعد جديد
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="divide-y divide-[var(--color-border)]">
        {bookings.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b)}
            className="w-full text-start flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-surface-2)] transition-colors"
          >
            {/* Time column */}
            <div className="text-center min-w-[50px] shrink-0">
              <p className="text-sm font-black text-[var(--color-text-primary)]" dir="ltr">
                {b.startTime}
              </p>
              {b.endTime && (
                <p className="text-[10px] text-[var(--color-text-muted)]" dir="ltr">
                  {b.endTime}
                </p>
              )}
            </div>

            {/* Divider dot */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-2.5 h-2.5 rounded-full border-2 ${
                  b.status === "CONFIRMED"
                    ? "border-green-500 bg-green-100"
                    : b.status === "PENDING"
                    ? "border-amber-400 bg-amber-50"
                    : b.status === "COMPLETED"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 bg-gray-100"
                }`}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                {b.customerName}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] truncate">{b.serviceName}</p>
            </div>

            {/* Status + price */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge status={b.status} size="sm" />
              <p className="text-xs font-semibold text-[var(--color-accent)]">
                {b.totalPrice.toLocaleString("ar-EG")} {b.currency}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
