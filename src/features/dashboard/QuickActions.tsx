import { CalendarPlus, Share2, Settings, BarChart3, MessageSquarePlus, Eye } from "lucide-react";
import Link from "next/link";

const actions = [
  {
    icon: CalendarPlus,
    label: "حجز يدوي",
    description: "أضف حجزًا بنفسك",
    href: "/dashboard/bookings/new",
    color: "blue",
  },
  {
    icon: Share2,
    label: "شارك رابطك",
    description: "انسخ رابط صفحتك",
    href: "#",
    color: "green",
    action: "copy",
  },
  {
    icon: Eye,
    label: "صفحتك العامة",
    description: "شوف كيف تبدو",
    href: "/company/bella-salon",
    color: "purple",
  },
  {
    icon: MessageSquarePlus,
    label: "رد على تقييم",
    description: "تقييم جديد ينتظرك",
    href: "/dashboard/reviews",
    color: "amber",
    badge: "٢",
  },
  {
    icon: BarChart3,
    label: "تقرير الشهر",
    description: "إحصائيات مارس",
    href: "/dashboard/analytics",
    color: "rose",
  },
  {
    icon: Settings,
    label: "إعدادات العمل",
    description: "أوقات العمل والخدمات",
    href: "/dashboard/settings",
    color: "gray",
  },
];

const colorMap: Record<string, { bg: string; icon: string }> = {
  blue:   { bg: "bg-blue-50",   icon: "text-blue-500" },
  green:  { bg: "bg-green-50",  icon: "text-green-500" },
  purple: { bg: "bg-purple-50", icon: "text-purple-500" },
  amber:  { bg: "bg-amber-50",  icon: "text-amber-500" },
  rose:   { bg: "bg-rose-50",   icon: "text-rose-500" },
  gray:   { bg: "bg-gray-50",   icon: "text-gray-500" },
};

export default function QuickActions() {
  return (
    <div className="card p-5">
      <h3 className="font-bold text-[var(--color-text-primary)] mb-4">
        إجراءات سريعة
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const colors = colorMap[action.color];
          const Icon = action.icon;

          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-2)] transition-colors group border border-transparent hover:border-[var(--color-border)]"
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}
              >
                <Icon size={16} className={colors.icon} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                    {action.label}
                  </p>
                  {action.badge && (
                    <span className="text-[10px] bg-[var(--color-accent)] text-white px-1.5 py-0.5 rounded-full font-bold">
                      {action.badge}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                  {action.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
