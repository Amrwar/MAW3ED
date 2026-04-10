"use client";

import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import type { Plan } from "@/lib/plans";
import type { BusinessType } from "@/lib/business-type";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Nav config per business type ────────────────────────────────────────────

function getNavConfig(businessType: BusinessType, s: Record<string, string>, pendingCount: number) {
  if (businessType === "RESTAURANT") {
    return {
      items: [
        { icon: LayoutDashboard, href: "/dashboard",            label: s.home,         soon: false, badge: null },
        { icon: CalendarDays,    href: "/dashboard/bookings",   label: s.reservations, soon: false, badge: pendingCount },
        { icon: Utensils,        href: "/dashboard/tables",     label: s.tables,       soon: false, badge: null },
        { icon: Users,           href: "/dashboard/customers",  label: s.customers,    soon: false, badge: null },
        { icon: BarChart3,       href: "/dashboard/analytics",  label: s.analytics,    soon: false, badge: null },
      ],
      secondary: [
        { icon: MessageSquare, href: "/dashboard/reviews",   label: s.reviews,   soon: true,  badge: null },
        { icon: Gift,          href: "/dashboard/referrals", label: s.referrals, soon: false, badge: null },
      ],
      utility: [
        { icon: Settings, href: "/dashboard/settings", label: s.settings, soon: false, badge: null },
      ],
    };
  }

  if (businessType === "BARBERSHOP") {
    return {
      items: [
        { icon: LayoutDashboard, href: "/dashboard",            label: s.home,         soon: false, badge: null },
        { icon: CalendarDays,    href: "/dashboard/bookings",   label: s.appointments, soon: false, badge: pendingCount },
        { icon: Scissors,        href: "/dashboard/services",   label: s.services,     soon: false, badge: null },
        { icon: Users2,          href: "/dashboard/staff",      label: s.staff,        soon: false, badge: null },
        { icon: Users,           href: "/dashboard/customers",  label: s.customers,    soon: false, badge: null },
        { icon: BarChart3,       href: "/dashboard/analytics",  label: s.analytics,    soon: false, badge: null },
      ],
      secondary: [
        { icon: MessageSquare, href: "/dashboard/reviews",   label: s.reviews,   soon: true,  badge: null },
        { icon: Gift,          href: "/dashboard/referrals", label: s.referrals, soon: false, badge: null },
      ],
      utility: [
        { icon: Settings, href: "/dashboard/settings", label: s.settings, soon: false, badge: null },
      ],
    };
  }

  // GENERAL (default)
  return {
    items: [
      { icon: LayoutDashboard, href: "/dashboard",           label: s.home,      soon: false, badge: null },
      { icon: CalendarDays,    href: "/dashboard/bookings",  label: s.bookings,  soon: false, badge: pendingCount },
      { icon: Store,           href: "/dashboard/services",  label: s.services,  soon: false, badge: null },
      { icon: Users,           href: "/dashboard/customers", label: s.customers, soon: false, badge: null },
      { icon: BarChart3,       href: "/dashboard/analytics", label: s.analytics, soon: false, badge: null },
    ],
    secondary: [
      { icon: MessageSquare, href: "/dashboard/reviews",   label: s.reviews,   soon: true,  badge: null },
      { icon: Gift,          href: "/dashboard/referrals", label: s.referrals, soon: false, badge: null },
    ],
    utility: [
      { icon: Settings, href: "/dashboard/settings", label: s.settings, soon: false, badge: null },
    ],
  };
}

// ─── Plan badge config ────────────────────────────────────────────────────────

const PLAN_STYLES: Record<Plan, { bg: string; text: string; label: string }> = {
  FREE:   { bg: "#F1F5F9", text: "#64748B",  label: "مجاني"    },
  GROWTH: { bg: "#DBEAFE", text: "#1D4ED8",  label: "نمو"      },
  PRO:    { bg: "#FEF3C7", text: "#92400E",  label: "احترافي"  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardSidebarProps {
  businessName?: string;
  cityName?:     string;
  pendingCount?: number;
  plan?:         Plan;
  businessType?: string;
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
      <div
        className="flex items-center gap-3 px-3.5 rounded-xl cursor-not-allowed select-none"
        style={{ paddingBlock: 10, color: "#CBD5E1" }}
      >
        <Icon size={16} strokeWidth={1.75} />
        <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{label}</span>
        <span
          style={{
            fontSize:     9,
            fontWeight:   700,
            padding:      "2px 7px",
            borderRadius: 100,
            background:   "#F1F5F9",
            color:        "#94A3B8",
            letterSpacing: "0.03em",
          }}
        >
          {comingSoonLabel}
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3.5 rounded-xl transition-all duration-150 group"
      style={{
        paddingBlock: 10,
        background:   active ? "#0F172A" : "transparent",
        color:        active ? "#FFFFFF" : "#64748B",
        boxShadow:    active ? "0 2px 8px rgba(15,23,42,0.16)" : "none",
        fontSize:     13,
        fontWeight:   active ? 600 : 500,
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "#F1F5F9";
          (e.currentTarget as HTMLAnchorElement).style.color      = "#0F172A";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
          (e.currentTarget as HTMLAnchorElement).style.color      = "#64748B";
        }
      }}
    >
      <Icon
        size={16}
        strokeWidth={active ? 2.25 : 1.75}
      />
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span
          style={{
            fontSize:     11,
            fontWeight:   700,
            padding:      "1px 7px",
            borderRadius: 100,
            background:   active ? "rgba(255,255,255,0.18)" : "#DBEAFE",
            color:        active ? "#FFFFFF" : "#1D4ED8",
            border:       active ? "1px solid rgba(255,255,255,0.12)" : "none",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function NavDivider() {
  return <div style={{ height: 1, background: "#F1F5F9", marginBlock: 6, marginInline: 4 }} />;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardSidebar({
  businessName,
  cityName     = "",
  pendingCount = 0,
  plan         = "FREE",
  businessType = "GENERAL",
}: DashboardSidebarProps) {
  const pathname  = usePathname();
  const { t }     = useLanguage();
  const s         = t.dashboard.sidebar as unknown as Record<string, string>;
  const name      = businessName || s.yourBusiness;
  const planStyle = PLAN_STYLES[plan];
  const navCfg    = getNavConfig(businessType as BusinessType, s, pendingCount);

  function NavGroup({ items }: { items: ReturnType<typeof getNavConfig>["items"] }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <NavItem
              key={item.href}
              href={item.href}
              Icon={item.icon}
              label={item.label}
              active={active}
              badge={item.badge}
              soon={item.soon}
              comingSoonLabel={s.comingSoon}
            />
          );
        })}
      </div>
    );
  }

  return (
    <aside
      className="hidden md:flex flex-col w-64 min-h-screen fixed top-0 bottom-0 start-0 z-40"
      style={{
        background:       "#FFFFFF",
        borderInlineEnd:  "1.5px solid #F1F5F9",
        boxShadow:        "4px 0 24px rgba(15,23,42,0.04)",
      }}
    >
      {/* ── Logo ────────────────────────────────────────────── */}
      <div
        className="h-16 flex items-center px-5 shrink-0"
        style={{ borderBottom: "1.5px solid #F1F5F9" }}
      >
        <Logo size="sm" />
      </div>

      {/* ── Business profile card ────────────────────────────── */}
      <div className="px-3 pt-3 pb-2.5 shrink-0">
        <div
          className="flex items-center gap-3 rounded-2xl px-3.5 py-3"
          style={{
            background: "#F8FAFC",
            border:     "1.5px solid #F1F5F9",
          }}
        >
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #0F172A 0%, #334155 100%)" }}
          >
            {name[0]}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p
              className="truncate"
              style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}
            >
              {name}
            </p>
            {cityName && (
              <p
                className="truncate"
                style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}
              >
                {cityName}
              </p>
            )}
          </div>

          {/* Plan badge */}
          <span
            className="shrink-0"
            style={{
              fontSize:     10,
              fontWeight:   700,
              padding:      "3px 8px",
              borderRadius: 100,
              background:   planStyle.bg,
              color:        planStyle.text,
              letterSpacing: "0.01em",
            }}
          >
            {planStyle.label}
          </span>
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────── */}
      <nav
        className="flex-1 overflow-y-auto"
        style={{ padding: "6px 10px 12px" }}
      >
        <NavGroup items={navCfg.items} />
        <NavDivider />
        <NavGroup items={navCfg.secondary} />
        <NavDivider />
        <NavGroup items={navCfg.utility} />
      </nav>

      {/* ── Bottom area ─────────────────────────────────────── */}
      <div
        className="shrink-0 px-3 pb-4 pt-3"
        style={{ borderTop: "1.5px solid #F1F5F9" }}
      >
        {/* Upgrade card — only for FREE plan */}
        {plan === "FREE" && (
          <Link
            href="/dashboard/settings?tab=subscription"
            className="flex items-start gap-3 rounded-2xl p-3.5 mb-3 transition-all duration-150 group"
            style={{
              background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
              boxShadow:  "0 4px 16px rgba(15,23,42,0.2)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 22px rgba(15,23,42,0.32)";
              (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 16px rgba(15,23,42,0.2)";
              (e.currentTarget as HTMLAnchorElement).style.transform = "";
            }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              <Image src="/icon-nobg.png" alt="موعد" width={28} height={28} className="object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", marginBottom: 2 }}>
                ترقية الخطة
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                حجوزات غير محدودة ومميزات احترافية
              </p>
            </div>
            <ArrowUpRight
              size={14}
              style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0, marginTop: 2 }}
            />
          </Link>
        )}

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full flex items-center gap-3 px-3.5 rounded-xl transition-all duration-150"
          style={{
            paddingBlock: 10,
            color:        "#94A3B8",
            background:   "transparent",
            fontSize:     13,
            fontWeight:   500,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#FEF2F2";
            (e.currentTarget as HTMLButtonElement).style.color      = "#EF4444";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color      = "#94A3B8";
          }}
        >
          <LogOut size={15} strokeWidth={1.75} />
          {s.signOut}
        </button>
      </div>
    </aside>
  );
}
