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
  ArrowUpRight,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import type { Plan } from "@/lib/plans";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Navigation structure ─────────────────────────────────────────────────────

const NAV_ICONS  = [LayoutDashboard, CalendarDays, Store, Users, BarChart3, MessageSquare, Gift, Settings];
const NAV_HREFS  = [
  "/dashboard",
  "/dashboard/bookings",
  "/dashboard/services",
  "/dashboard/customers",
  "/dashboard/analytics",
  "/dashboard/reviews",
  "/dashboard/referrals",
  "/dashboard/settings",
];
const NAV_SOON   = [false, false, false, false, false, true, false, false];

// Indices for each group (dividers are placed between groups)
const GROUP_MAIN       = [0, 1, 2, 3, 4]; // home → analytics
const GROUP_SECONDARY  = [5, 6];           // reviews, referrals
const GROUP_UTILITY    = [7];              // settings

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
}: DashboardSidebarProps) {
  const pathname    = usePathname();
  const { t }       = useLanguage();
  const s           = t.dashboard.sidebar;
  const navLabels   = [s.home, s.bookings, s.services, s.customers, s.analytics, s.reviews, s.referrals, s.settings];
  const name        = businessName || s.yourBusiness;
  const planStyle   = PLAN_STYLES[plan];

  function NavGroup({ indices }: { indices: number[] }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {indices.map((i) => {
          const href   = NAV_HREFS[i];
          const Icon   = NAV_ICONS[i];
          const label  = navLabels[i];
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          const badge  = href === "/dashboard/bookings" ? pendingCount : null;
          const soon   = NAV_SOON[i];
          return (
            <NavItem
              key={href}
              href={href}
              Icon={Icon}
              label={label}
              active={active}
              badge={badge}
              soon={soon}
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
        <NavGroup indices={GROUP_MAIN} />
        <NavDivider />
        <NavGroup indices={GROUP_SECONDARY} />
        <NavDivider />
        <NavGroup indices={GROUP_UTILITY} />
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
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              <Sparkles size={14} style={{ color: "#FCD34D" }} />
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
