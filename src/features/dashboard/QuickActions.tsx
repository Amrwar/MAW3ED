import { CalendarPlus, Share2, Settings, BarChart3, Eye } from "lucide-react";
import Link from "next/link";

interface Props {
  slug: string;
}

const colorMap: Record<string, { bg: string; icon: string }> = {
  blue:   { bg: "bg-blue-50",   icon: "text-blue-500"   },
  green:  { bg: "bg-green-50",  icon: "text-green-500"  },
  purple: { bg: "bg-purple-50", icon: "text-purple-500" },
  rose:   { bg: "bg-rose-50",   icon: "text-rose-500"   },
  gray:   { bg: "bg-gray-50",   icon: "text-gray-500"   },
};

export default function QuickActions({ slug }: Props) {
  const actions = [
    {
      icon:        CalendarPlus,
      label:       "حجز يدوي",
      description: "أضف حجزًا بنفسك",
      href:        "/dashboard/bookings",
      color:       "blue",
    },
    {
      icon:        Eye,
      label:       "صفحتك العامة",
      description: "شوف كيف تبدو",
      href:        `/company/${slug}`,
      color:       "purple",
    },
    {
      icon:        BarChart3,
      label:       "الإحصائيات",
      description: "تقارير وأداء العمل",
      href:        "/dashboard/analytics",
      color:       "rose",
    },
    {
      icon:        Settings,
      label:       "إعدادات العمل",
      description: "أوقات العمل والخدمات",
      href:        "/dashboard/settings",
      color:       "gray",
    },
  ];

  return (
    <div className="card p-5">
      <h3 className="font-bold text-[var(--color-text-primary)] mb-4">إجراءات سريعة</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const colors = colorMap[action.color];
          const Icon   = action.icon;

          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-2)] transition-colors border border-transparent hover:border-[var(--color-border)]"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}>
                <Icon size={16} className={colors.icon} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                  {action.label}
                </p>
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
