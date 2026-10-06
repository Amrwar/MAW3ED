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
  ArrowUpRight,
  Utensils,
  Scissors,
  Users2,
  CalendarCheck,
  Armchair,
  Building2,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import type { Plan } from "@/lib/plans";
import type { BusinessType } from "@/lib/business-type";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * One navigation, for every business. See the note on the identical
 * function in DashboardHeader — this is the sidebar's copy of the same
 * list, in the shape this component renders.
 */
function getNavConfig(
  s: Record<string, string>,
  pendingCount: number,
  resourceWord: string,
) {
  return {
    items: [
      { icon: LayoutDashboard, href: "/dashboard",           label: s.home,      soon: false, badge: null },
      { icon: CalendarDays,    href: "/dashboard/calendar",  label: s.calendar,  soon: false, badge: null },
      { icon: CalendarCheck,   href: "/dashboard/bookings",  label: s.bookings,  soon: false, badge: pendingCount },
      { icon: Users,           href: "/dashboard/customers", label: s.customers, soon: false, badge: null },
      { icon: BarChart3,       href: "/dashboard/analytics", label: s.analytics, soon: false, badge: null },
    ],
    secondary: [
      { icon: Store,         href: "/dashboard/services",  label: s.services,  soon: false, badge: null },
      { icon: Users2,        href: "/dashboard/staff",     label: s.staff,     soon: false, badge: null },
      { icon: Armchair,      href: "/dashboard/resources", label: resourceWord, soon: false, badge: null },
      { icon: Building2,     href: "/dashboard/branches",  label: s.branches,  soon: false, badge: null },
      { icon: MessageSquare, href: "/dashboard/reviews",   label: s.reviews,   soon: true,  badge: null },
      { icon: Gift,          href: "/dashboard/referrals", label: s.referrals, soon: false, badge: null },
    ],
    utility: [
      { icon: Settings, href: "/dashboard/settings", label: s.settings, soon: false, badge: null },
    ],
  };
}

// ─── Plan badge config ────────────────────────────────────────────────────────

const PLAN_STYLES: Record<Plan, { cls: string; label: string }> = {
  FREE:    { cls: "bg-[var(--color-night-line)] text-[#BACBC4]", label: "مجاني"   },
  PRO:     { cls: "bg-[var(--color-jade)] text-white",           label: "احترافي" },
  PREMIUM: { cls: "bg-[var(--color-star)] text-[var(--color-night)]", label: "مميز" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardSidebarProps {
  businessName?: string;
  cityName?:     string;
  pendingCount?: number;
  plan?:         Plan;
  resourceWord?: string;
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  href,
  Icon,
  label,
  active,
  badge,
  soon,
  comingSoonLabel,
}: {
  href:            string;
  Icon:            React.ElementType;
  label:           string;
  active:          boolean;
  badge?:          number | null;
  soon?:           boolean;
  comingSoonLabel: string;
}) {
  if (soon) {
    return (
      <div className="flex min-h-11 cursor-not-allowed select-none items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[0.84375rem] text-[var(--color-night-subtle)]/60">
        <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
        <span className="flex-1">{label}</span>
        <span className="rounded-full bg-[var(--color-night-line)] px-2 py-0.5 text-[0.625rem] font-bold text-[var(--color-night-subtle)]">
          {comingSoonLabel}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[0.84375rem] transition-colors",
        active
          ? "bg-[var(--color-jade)] font-bold text-white"
          : "text-[#BACBC4] hover:bg-[var(--color-night-2)] hover:text-white",
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.1 : 1.75} aria-hidden="true" />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span
          className={cn(
            "num rounded-full px-2 py-0.5 text-[0.6875rem] font-bold",
            active ? "bg-white/22 text-white" : "bg-[var(--color-night-line)] text-white",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function NavDivider() {
  return <div aria-hidden="true" className="my-2 mx-1 h-px bg-[var(--color-night-line)]" />;
}

function NavGroup({
  items,
  pathname,
  comingSoonLabel,
}: {
  items: ReturnType<typeof getNavConfig>["items"];
  pathname: string;
  comingSoonLabel: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <NavItem
            key={item.href}
            href={item.href}
            Icon={item.icon}
            label={item.label}
            active={active}
            badge={item.badge}
            soon={item.soon}
            comingSoonLabel={comingSoonLabel}
          />
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardSidebar({
  businessName,
  cityName     = "",
  pendingCount = 0,
  plan         = "FREE",
  resourceWord,
}: DashboardSidebarProps) {
  const pathname  = usePathname();
  const { t }     = useLanguage();
  const s         = t.dashboard.sidebar as unknown as Record<string, string>;
  const name      = businessName || s.yourBusiness;
  const planStyle = PLAN_STYLES[plan];
  const navCfg    = getNavConfig(s, pendingCount, resourceWord ?? s.resources);

  return (
    <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col bg-[var(--color-night)] md:flex">

      {/* ── Logo ── */}
      <div className="flex h-20 shrink-0 items-center px-5">
        <Logo size="sm" variant="white" />
      </div>

      {/* ── Business switcher ── */}
      <div className="shrink-0 px-4 pb-4">
        <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-night-line)] bg-[var(--color-night-2)] px-3 py-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-jade)] text-sm font-extrabold text-white"
          >
            {name[0]}
          </span>

          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[0.8125rem] font-bold leading-tight text-white">{name}</p>
            {cityName && (
              <p className="m-0 mt-0.5 truncate text-[0.6875rem] text-[var(--color-night-subtle)]">
                {cityName}
              </p>
            )}
          </div>

          <span className={cn("shrink-0 rounded-full px-2 py-1 text-[0.625rem] font-bold", planStyle.cls)}>
            {planStyle.label}
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <NavGroup items={navCfg.items} pathname={pathname} comingSoonLabel={s.comingSoon} />
        <NavDivider />
        <NavGroup items={navCfg.secondary} pathname={pathname} comingSoonLabel={s.comingSoon} />
        <NavDivider />
        <NavGroup items={navCfg.utility} pathname={pathname} comingSoonLabel={s.comingSoon} />
      </nav>

      {/* ── Bottom ── */}
      <div className="shrink-0 border-t border-[var(--color-night-line)] px-3 py-4">
        {plan === "FREE" && (
          <Link
            href="/dashboard/settings?tab=subscription"
            className="mb-3 flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-night-line)] bg-[var(--color-night-2)] p-3.5 transition-colors hover:border-[var(--color-jade)]"
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-jade)]"
            >
              <ArrowUpRight size={16} strokeWidth={2.2} className="text-white" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.75rem] font-bold text-white">ترقية الخطة</span>
              <span className="mt-1 block text-[0.6875rem] leading-relaxed text-[var(--color-night-subtle)]">
                حجوزات غير محدودة ومميزات احترافية
              </span>
            </span>
          </Link>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-3 text-[0.84375rem] text-[var(--color-night-subtle)] transition-colors hover:bg-[var(--color-night-2)] hover:text-[#E0705E]"
        >
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          {s.signOut}
        </button>
      </div>
    </aside>
  );
}
