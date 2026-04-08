"use client";

import { CalendarPlus, Share2, Settings, BarChart3, Eye } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

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

const ACTION_ICONS = [CalendarPlus, Eye, BarChart3, Settings];
const ACTION_COLORS = ["blue", "purple", "rose", "gray"];
const ACTION_HREFS  = ["/dashboard/bookings", "", "/dashboard/analytics", "/dashboard/settings"];

export default function QuickActions({ slug }: Props) {
  const { t }   = useLanguage();
  const qa      = t.dashboard.quickActions;

  return (
    <div className="card p-5">
      <h3 className="font-bold text-[var(--color-text-primary)] mb-4">{qa.title}</h3>
      <div className="grid grid-cols-2 gap-3">
        {qa.actions.map((action, i) => {
          const href   = i === 1 ? `/company/${slug}` : ACTION_HREFS[i];
          const colors = colorMap[ACTION_COLORS[i]];
          const Icon   = ACTION_ICONS[i];

          return (
            <Link
              key={i}
              href={href}
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
                  {action.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
