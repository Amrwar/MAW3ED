import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import type { BookingStatus } from "@/types/booking";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";

const bookings = [
  {
    id: "B001",
    customer: "نور محمد",
    phone: "0100 000 0001",
    service: "كشف باطنة",
    date: "اليوم، ١٠:٠٠ ص",
    price: "٢٥٠ ج",
    status: "confirmed" as BookingStatus,
  },
  {
    id: "B002",
    customer: "أحمد علي",
    phone: "0100 000 0002",
    service: "كشف قلب",
    date: "اليوم، ١١:٣٠ ص",
    price: "٤٠٠ ج",
    status: "pending" as BookingStatus,
  },
  {
    id: "B003",
    customer: "مريم حسن",
    phone: "0100 000 0003",
    service: "كشف أطفال",
    date: "غد، ٩:٠٠ ص",
    price: "٣٠٠ ج",
    status: "confirmed" as BookingStatus,
  },
  {
    id: "B004",
    customer: "خالد محمود",
    phone: "0100 000 0004",
    service: "كشف باطنة",
    date: "الثلاثاء، ٢:٠٠ م",
    price: "٢٥٠ ج",
    status: "cancelled" as BookingStatus,
  },
  {
    id: "B005",
    customer: "فاطمة سامي",
    phone: "0100 000 0005",
    service: "كشف قلب",
    date: "الأربعاء، ١٠:٠٠ ص",
    price: "٤٠٠ ج",
    status: "completed" as BookingStatus,
  },
];

const statusConfig: Record<
  BookingStatus,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  confirmed: {
    label: "مؤكد",
    icon: CheckCircle,
    className: "bg-green-50 text-green-600",
  },
  pending: {
    label: "في الانتظار",
    icon: Clock,
    className: "bg-amber-50 text-amber-600",
  },
  completed: {
    label: "مكتمل",
    icon: CheckCircle,
    className: "bg-blue-50 text-blue-600",
  },
  cancelled: {
    label: "ملغي",
    icon: XCircle,
    className: "bg-red-50 text-red-500",
  },
  no_show: {
    label: "لم يحضر",
    icon: AlertCircle,
    className: "bg-gray-100 text-gray-500",
  },
};

export default function RecentBookings() {
  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
        <h3 className="font-bold text-[var(--color-text-primary)]">
          آخر الحجوزات
        </h3>
        <Button variant="ghost" size="sm">
          عرض الكل
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
              {["العميل", "الخدمة", "الموعد", "السعر", "الحالة", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="text-start px-5 py-3 text-xs font-semibold text-[var(--color-text-muted)]"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking, i) => {
              const status = statusConfig[booking.status];
              const StatusIcon = status.icon;

              return (
                <tr
                  key={booking.id}
                  className={cn(
                    "border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-2)] transition-colors",
                  )}
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {booking.customer}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">
                      {booking.phone}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {booking.service}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {booking.date}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {booking.price}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
                        status.className
                      )}
                    >
                      <StatusIcon size={11} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-medium transition-colors">
                      عرض
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
