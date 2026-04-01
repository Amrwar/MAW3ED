import { Calendar, DollarSign, TrendingUp, Users } from "lucide-react";
import type { AnalyticsPayload } from "@/app/api/business/analytics/route";

export default function KPICards({ kpis }: { kpis: AnalyticsPayload["kpis"] }) {
  const cards = [
    {
      label:   "إجمالي الحجوزات",
      value:   kpis.totalBookings.toLocaleString("ar-EG"),
      sub:     "حجز غير ملغي",
      icon:    Calendar,
      bg:      "bg-blue-50",
      iconCls: "text-blue-500",
    },
    {
      label:   "الإيرادات المحققة",
      value:   kpis.completedRevenue.toLocaleString("ar-EG"),
      sub:     kpis.currency,
      icon:    DollarSign,
      bg:      "bg-green-50",
      iconCls: "text-green-500",
    },
    {
      label:   "متوسط قيمة الحجز",
      value:   Math.round(kpis.avgBookingValue).toLocaleString("ar-EG"),
      sub:     kpis.currency,
      icon:    TrendingUp,
      bg:      "bg-purple-50",
      iconCls: "text-purple-500",
    },
    {
      label:   "معدل العملاء المتكررين",
      value:   `${Math.round(kpis.repeatCustomerRate * 100).toLocaleString("ar-EG")}٪`,
      sub:     "عملاء بأكثر من حجز",
      icon:    Users,
      bg:      "bg-amber-50",
      iconCls: "text-amber-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-4`}>
              <Icon size={18} className={c.iconCls} />
            </div>
            <p className="text-2xl font-black text-[var(--color-text-primary)] leading-none">
              {c.value}
            </p>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">{c.label}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{c.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
