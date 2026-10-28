"use client";

import Link from "@/components/shared/LocaleLink";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import type { Plan } from "@/lib/plans";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { buildNav, isActive, isGroupOpen, type NavSection } from "@/lib/dashboard/nav";

// ─── Navigation ───────────────────────────────────────────────────────────────


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
  /** Entries for things the business does not have are left out. */
  hasResources?: boolean;
  hasBranches?:  boolean;
  /** Shows the moderation entry; nobody else sees it exists. */
  isAdmin?:      boolean;
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  href,
  Icon,
  label,
  active,
  badge,
}: {
  href:   string;
  Icon:   React.ElementType;
  label:  string;
  active: boolean;
  badge?: number | null;
}) {
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
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {section.title && (
        <p className="m-0 px-3 pb-1 pt-3 text-[0.625rem] font-bold uppercase tracking-wider text-[var(--color-night-subtle)]">
          {section.title}
        </p>
      )}
      {section.items.map((item) => {
        const open = isGroupOpen(item, pathname);
        return (
          <div key={item.href}>
            <NavItem
              href={item.href}
              Icon={item.icon}
              label={item.label}
              active={isActive(item.href, pathname)}
              badge={item.badge ?? null}
            />
            {/* A group's children only take up room while you are in it. */}
            {item.children && open && (
              <div className="mb-1 ms-6 flex flex-col gap-0.5 border-s border-[var(--color-night-line)] ps-2">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "flex min-h-9 items-center rounded-[var(--radius-sm)] px-3 text-[0.78125rem] transition-colors",
                      isActive(child.href, pathname)
                        ? "bg-white/15 font-bold text-white"
                        : "text-[var(--color-night-subtle)] hover:bg-white/8 hover:text-white",
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
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
  hasResources = false,
  hasBranches  = false,
  isAdmin      = false,
}: DashboardSidebarProps) {
  const pathname  = usePathname();
  const { t }     = useLanguage();
  const s         = t.dashboard.sidebar as unknown as Record<string, string>;
  const name      = businessName || s.yourBusiness;
  const planStyle = PLAN_STYLES[plan];
  const sections  = buildNav({
    labels: s,
    pendingCount,
    resourceWord: resourceWord ?? s.resources,
    hasResources,
    hasBranches,
    isAdmin,
  });

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
            {t.dashboard.sidebar.planBadge[plan] ?? planStyle.label}
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {sections.map((section, i) => (
          <div key={section.title ?? "main"}>
            {i > 0 && <NavDivider />}
            <NavGroup section={section} pathname={pathname} />
          </div>
        ))}
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
              <span className="block text-[0.75rem] font-bold text-white">{s.upgradeTitle}</span>
              <span className="mt-1 block text-[0.6875rem] leading-relaxed text-[var(--color-night-subtle)]">
                {s.upgradeBody}
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
