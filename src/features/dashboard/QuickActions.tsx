"use client";

import { CalendarPlus, Eye, BarChart3, Settings, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props { slug: string }

const ACTION_ICONS   = [CalendarPlus, Eye, BarChart3, Settings];
const ACTION_HREFS   = ["/dashboard/bookings", "", "/dashboard/analytics", "/dashboard/settings"];

const ACTION_ICON_BG    = ["#EFF6FF", "#F5F3FF", "#FFF7ED", "#F8FAFC"];
const ACTION_ICON_COLOR = ["#1D4ED8",  "#7C3AED",  "#EA580C",  "#475569"];
const ACTION_ACCENT     = ["#1D4ED8",  "#7C3AED",  "#EA580C",  "#475569"];

export default function QuickActions({ slug }: Props) {
  const { t } = useLanguage();
  const qa    = t.dashboard.quickActions;

  return (
    <div
      className="rounded-2xl border bg-white overflow-hidden"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
    >
      {/* Header */}
      <div className="px-5 py-4" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <h3 className="text-sm font-bold text-[#0F172A]">{qa.title}</h3>
      </div>

      {/* Action list */}
      <div className="p-3 space-y-1">
        {qa.actions.map((action, i) => {
          const href  = i === 1 ? `/company/${slug}` : ACTION_HREFS[i];
          const Icon  = ACTION_ICONS[i];
          const isExt = i === 1;

          return (
            <Link
              key={i}
              href={href}
              target={isExt ? "_blank" : undefined}
              rel={isExt ? "noopener noreferrer" : undefined}
              className="flex items-center gap-3 p-3 rounded-xl transition-all duration-150 group"
              style={{ color: "#0F172A" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = ACTION_ICON_BG[i];
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.background = "transparent";
              }}
            >
              {/* Icon box */}
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105"
                style={{ background: ACTION_ICON_BG[i] }}
              >
                <Icon size={16} strokeWidth={1.75} style={{ color: ACTION_ICON_COLOR[i] }} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A] leading-snug">
                  {action.label}
                </p>
                <p className="text-xs text-[#94A3B8] mt-0.5 truncate">{action.desc}</p>
              </div>

              {/* Arrow */}
              <ChevronLeft
                size={14}
                strokeWidth={2}
                style={{ color: ACTION_ACCENT[i], opacity: 0.6 }}
                className="shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
