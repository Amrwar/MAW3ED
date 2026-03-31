import { TrendingUp, TrendingDown, Calendar, Users, Star, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  {
    label: "إجمالي الحجوزات",
    value: "١٢٤",
    change: "+١٨٪",
    trend: "up",
    period: "هذا الشهر",
    icon: Calendar,
    color: "blue",
  },
  {
    label: "العملاء الجدد",
    value: "٣٧",
    change: "+٢٤٪",
    trend: "up",
    period: "هذا الشهر",
    icon: Users,
    color: "green",
  },
  {
    label: "متوسط التقييم",
    value: "٤.٨",
    change: "+٠.٢",
    trend: "up",
    period: "آخر ٣٠ يوم",
    icon: Star,
    color: "amber",
  },
  {
    label: "الإيرادات",
    value: "٢٤,٥٠٠",
    change: "-٥٪",
    trend: "down",
    period: "مقارنة بالشهر الماضي",
    icon: DollarSign,
    color: "purple",
    suffix: "ج.م",
  },
];

const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
  blue:   { bg: "bg-blue-50",   icon: "text-blue-500",   text: "text-blue-600" },
  green:  { bg: "bg-green-50",  icon: "text-green-500",  text: "text-green-600" },
  amber:  { bg: "bg-amber-50",  icon: "text-amber-500",  text: "text-amber-600" },
  purple: { bg: "bg-purple-50", icon: "text-purple-500", text: "text-purple-600" },
};

export default function StatsCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const colors = colorMap[stat.color];
        const Icon = stat.icon;

        return (
          <div key={stat.label} className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  colors.bg
                )}
              >
                <Icon size={18} className={colors.icon} />
              </div>
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                  stat.trend === "up"
                    ? "bg-green-50 text-green-600"
                    : "bg-red-50 text-red-500"
                )}
              >
                {stat.trend === "up" ? (
                  <TrendingUp size={11} />
                ) : (
                  <TrendingDown size={11} />
                )}
                {stat.change}
              </div>
            </div>

            <p className="text-2xl font-black text-[var(--color-text-primary)] mb-0.5">
              {stat.value}
              {stat.suffix && (
                <span className="text-sm font-medium text-[var(--color-text-muted)] ms-1">
                  {stat.suffix}
                </span>
              )}
            </p>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {stat.label}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {stat.period}
            </p>
          </div>
        );
      })}
    </div>
  );
}
