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
  HelpCircle,
  LogOut,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plans";
import { useLanguage } from "@/contexts/LanguageContext";

const NAV_ICONS = [LayoutDashboard, CalendarDays, Store, Users, BarChart3, MessageSquare, Gift, Settings];
const BOTTOM_ICONS = [HelpCircle];

const PLAN_BADGE_CLASS: Record<Plan, string> = {
  FREE:   "bg-gray-100 text-gray-500",
  GROWTH: "bg-blue-100 text-blue-600",
  PRO:    "bg-amber-100 text-amber-600",
};

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

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-white border-e border-[var(--color-border)] fixed top-0 bottom-0 start-0 z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-[var(--color-border)]">
        <Logo size="sm" />
      </div>

      {/* Business info */}
      <div className="px-4 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center text-sm font-bold text-[var(--color-accent)]">
            {name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {name}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{cityName}</p>
          </div>
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", PLAN_BADGE_CLASS[plan])}>
            {s.planBadge[plan]}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_HREFS.map((href, i) => {
          const Icon   = NAV_ICONS[i];
          const label  = navLabels[i];
          const active = pathname === href;
          const badge  = href === "/dashboard/bookings" ? pendingCount : null;
          if (NAV_SOON[i]) {
            return (
              <div
                key={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-muted)] cursor-not-allowed opacity-60"
              >
                <Icon size={17} />
                <span className="flex-1">{label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                  {s.comingSoon}
                </span>
              </div>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {badge != null && badge > 0 && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full font-medium",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[var(--color-border)] space-y-0.5">
        {BOTTOM_ICONS.map((Icon, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-muted)] opacity-60 cursor-not-allowed"
          >
            <Icon size={17} />
            <span className="flex-1">{s.help}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
              {s.comingSoon}
            </span>
          </div>
        ))}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={17} />
          {s.signOut}
        </button>
      </div>
    </aside>
  );
}
