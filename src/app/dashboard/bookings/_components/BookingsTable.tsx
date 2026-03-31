import StatusBadge from "@/features/dashboard/bookings/StatusBadge";
import { type DashboardBooking, formatDateAr } from "@/features/dashboard/bookings/types";
import { Loader2 } from "lucide-react";

interface BookingsTableProps {
  bookings:  DashboardBooking[];
  loading:   boolean;
  selected:  string | null;
  onSelect:  (b: DashboardBooking) => void;
}

export default function BookingsTable({
  bookings,
  loading,
  selected,
  onSelect,
}: BookingsTableProps) {
  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <h3 className="font-bold text-[var(--color-text-primary)]">
          \u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a
        </h3>
        {loading && <Loader2 size={16} className="animate-spin text-[var(--color-brand)]" />}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
              {[
                "\u0627\u0644\u0639\u0645\u064a\u0644",
                "\u0627\u0644\u062e\u062f\u0645\u0629",
                "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
                "\u0627\u0644\u0648\u0642\u062a",
                "\u0627\u0644\u062d\u0627\u0644\u0629",
                "\u0627\u0644\u0633\u0639\u0631",
                "",
              ].map((h) => (
                <th
                  key={h}
                  className="text-start px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && bookings.length === 0 ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className="h-4 bg-[var(--color-border)] rounded animate-pulse" />
                    </td>
                  ))}
                  <td className="px-4 py-4" />
                </tr>
              ))
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    \u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u062c\u0648\u0632\u0627\u062a \u062a\u0637\u0627\u0628\u0642 \u0627\u0644\u0628\u062d\u062b
                  </p>
                </td>
              </tr>
            ) : (
              bookings.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => onSelect(b)}
                  className={`border-b border-[var(--color-border)] last:border-0 cursor-pointer transition-colors ${
                    selected === b.id
                      ? "bg-[var(--color-brand)]/5"
                      : "hover:bg-[var(--color-surface-2)]"
                  }`}
                >
                  {/* Customer */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {b.customerName}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">
                      {b.customerPhone}
                    </p>
                  </td>

                  {/* Service */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-[var(--color-text-secondary)]">{b.serviceName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {b.serviceDuration} \u062f\u0642\u064a\u0642\u0629
                    </p>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {formatDateAr(b.date)}
                    </p>
                  </td>

                  {/* Time */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-[var(--color-text-secondary)]" dir="ltr">
                      {b.startTime}
                      {b.endTime ? ` \u2013 ${b.endTime}` : ""}
                    </p>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    <StatusBadge status={b.status} />
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {b.totalPrice.toLocaleString("ar-EG")}{" "}
                      <span className="font-normal text-[var(--color-text-muted)]">
                        {b.currency}
                      </span>
                    </p>
                  </td>

                  {/* Arrow */}
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      \u062a\u0641\u0627\u0635\u064a\u0644
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
