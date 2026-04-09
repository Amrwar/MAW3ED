"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarDays,
  Settings,
  Store,
  BarChart3,
  Users,
  MessageSquare,
  Gift,
  LogOut,
  Sparkles,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import type { Plan } from "@/lib/plans";
import { useLanguage } from "@/contexts/LanguageContext";

const NAV_ICONS = [LayoutDashboard, CalendarDays, Store, Users, BarChart3, MessageSquare, Gift, Settings];
const NAV_HREFS = [
  "/dashboard",
  "/dashboard/bookings",
  "/dashboard/services",
  "/dashboard/customers",
  "/dashboard/analytics",
  "/dashboard/reviews",
  "/dashboard/referrals",
  "/dashboard/settings",
];
const NAV_SOON = [false, false, false, false, false, true, false, false];

const PLAN_STYLES: Record<Plan, { bg: string; text: string; label: string }> = {
  FREE:   { bg: "#F1F5F9", text: "#64748B", label: "مجاني"  },
  GROWTH: { bg: "#DBEAFE", text: "#1D4ED8", label: "نمو"    },
  PRO:    { bg: "#FEF3C7", text: "#92400E", label: "احترافي" },
};

interface DashboardSidebarProps {
  businessName?: string;
  cityName?:     string;
  pendingCount?: number;
  plan?:         Plan;
}

export default function DashboardSidebar({
  businessName,
  cityName     = "",
  pendingCount = 0,
  plan         = "FREE",
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { t }    = useLanguage();
  const s        = t.dashboard.sidebar;
  const navLabels = [s.home, s.bookings, s.services, s.customers, s.analytics, s.reviews, s.referrals, s.settings];
  const name      = businessName || s.yourBusiness;
  const planStyle = PLAN_STYLES[plan];

  return (
    <aside
      className="hidden md:flex flex-col w-64 min-h-screen fixed top-0 bottom-0 start-0 z-40"
      style={{
        background:  "#FFFFFF",
        borderInlineEnd: "1px solid #E2E8F0",
      }}
    >
      {/* ── Logo ── */}
      <div
        className="h-16 flex items-center px-5 shrink-0"
        style={{ borderBottom: "1px solid #F1F5F9" }}
      >
        <Logo size="sm" />
      </div>

      {/* ── Business profile card ── */}
      <div className="px-4 py-4 shrink-0" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "#F8FAFC" }}>
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
          >
            {name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#0F172A] truncate leading-snug">{name}</p>
            {cityName && (
              <p className="text-xs text-[#94A3B8] truncate mt-0.5">{cityName}</p>
            )}
          </div>
          {/* Plan badge */}
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: planStyle.bg, color: planStyle.text }}
          >
            {planStyle.label}
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_HREFS.map((href, i) => {
          const Icon   = NAV_ICONS[i];
          const label  = navLabels[i];
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const badge  = href === "/dashboard/bookings" ? pendingCount : null;
          const soon   = NAV_SOON[i];

          if (soon) {
            return (
              <div
                key={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-not-allowed opacity-50"
                style={{ color: "#94A3B8" }}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span className="flex-1 font-medium">{label}</span>
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "#F1F5F9", color: "#94A3B8" }}
                >
                  {s.comingSoon}
                </span>
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                background: active ? "#0F172A" : "transparent",
                color:      active ? "#FFFFFF" : "#475569",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#F8FAFC";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#0F172A";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#475569";
                }
              }}
            >
              <Icon
                size={16}
                strokeWidth={active ? 2 : 1.75}
                style={{ opacity: active ? 1 : 0.75 }}
              />
              <span className="flex-1">{label}</span>
              {badge != null && badge > 0 && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: active ? "rgba(255,255,255,0.2)" : "#DBEAFE",
                    color:      active ? "#FFFFFF" : "#1D4ED8",
                  }}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom ── */}
      <div className="px-3 py-4 shrink-0" style={{ borderTop: "1px solid #F1F5F9" }}>
        {/* Upgrade nudge for FREE plan */}
        {plan === "FREE" && (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 px-3 py-3 mb-2 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{ background: "#EFF6FF", color: "#1D4ED8" }}
          >
            <Sparkles size={15} />
            <span className="flex-1">ترقية الخطة</span>
          </Link>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
          style={{ color: "#EF4444" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <LogOut size={16} strokeWidth={1.75} />
          {s.signOut}
        </button>
      </div>
    </aside>
  );
}
