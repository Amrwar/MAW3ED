"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  User2,
  LayoutDashboard,
  Settings2,
  LogOut,
  Bell,
  ChevronDown,
  Store,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────

export interface NavUser {
  id:          string;
  email:       string;
  name?:       string | null;
  businessId?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────

function getInitials(name?: string | null, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email?.[0] ?? "U").toUpperCase();
}

// ─── UserAvatar ────────────────────────────────────────────
// Exported so Navbar can reuse it in the mobile menu.

export function UserAvatar({
  name,
  email,
  size = "md",
}: {
  name?:   string | null;
  email:   string;
  size?:   "sm" | "md" | "lg";
}) {
  const dims = { sm: "w-7 h-7 text-[10px]", md: "w-9 h-9 text-sm", lg: "w-11 h-11 text-base" };

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none",
        dims[size],
      )}
      style={{ background: "linear-gradient(140deg, var(--color-jade) 0%, var(--color-jade) 100%)" }}
    >
      {getInitials(name, email)}
    </div>
  );
}

// ─── NotificationBell ──────────────────────────────────────
// Standalone bell button — no dropdown yet, clean placeholder.

export function NotificationBell() {
  const { lang } = useLanguage();
  const label = lang === "ar" ? "الإشعارات" : "Notifications";

  return (
    <button
      type="button"
      aria-label={label}
      className="relative p-2 rounded-[var(--radius-md)] text-[var(--color-subtle)] hover:text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] transition-all duration-150"
    >
      <Bell size={17} strokeWidth={1.8} />
    </button>
  );
}

// ─── DropdownItem ──────────────────────────────────────────

type DropdownItemProps = {
  icon:    React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label:   string;
  href?:   string;
  onClick?: () => void;
  danger?: boolean;
};

function DropdownItem({ icon: Icon, label, href, onClick, danger = false }: DropdownItemProps) {
  const base = cn(
    "group flex items-center gap-3 w-full px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium",
    "transition-all duration-150 text-start",
    danger
      ? "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      : "text-[var(--color-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]",
  );

  const iconClass = cn(
    "shrink-0 transition-colors duration-150",
    danger
      ? "text-[var(--color-danger)] group-hover:text-[var(--color-danger)]"
      : "text-[var(--color-subtle)] group-hover:text-[var(--color-muted)]",
  );

  if (href) {
    return (
      <Link href={href} className={base}>
        <Icon size={15} strokeWidth={1.8} className={iconClass} />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={base}>
      <Icon size={15} strokeWidth={1.8} className={iconClass} />
      {label}
    </button>
  );
}

// ─── UserMenu ──────────────────────────────────────────────

interface UserMenuProps {
  user: NavUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const { lang } = useLanguage();
  const [open, setOpen]   = useState(false);
  const menuRef           = useRef<HTMLDivElement>(null);

  // ── Close on outside click ─────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // ── Close on Escape ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // ── Logout ─────────────────────────────────────────────
  async function handleLogout() {
    setOpen(false);
    await signOut({ callbackUrl: "/" });
  }

  const hasBusiness = !!user.businessId;

  const L = {
    profile:   lang === "ar" ? "الملف الشخصي" : "Profile",
    dashboard: lang === "ar" ? "لوحة التحكم"  : "Dashboard",
    business:  lang === "ar" ? "إدارة نشاطي"   : "My Business",
    settings:  lang === "ar" ? "الإعدادات"     : "Settings",
    logout:    lang === "ar" ? "تسجيل الخروج"  : "Log out",
  };

  return (
    <div className="relative" ref={menuRef}>

      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-1.5 px-1.5 py-1.5 rounded-[var(--radius-md)] transition-all duration-150 outline-none",
          "focus-visible:ring-2 focus-visible:ring-[var(--color-jade)] focus-visible:ring-offset-1",
          open ? "bg-[var(--color-surface-3)]" : "hover:bg-[var(--color-surface-2)]",
        )}
      >
        <UserAvatar name={user.name} email={user.email} size="md" />
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={cn(
            "text-[var(--color-subtle)] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {/* ── Dropdown ── */}
      <div
        role="menu"
        aria-label={lang === "ar" ? "قائمة المستخدم" : "User menu"}
        className="absolute z-50 end-0 mt-2 w-56 rounded-[var(--radius-lg)] bg-white border border-[var(--color-line)] py-1.5 overflow-hidden"
        style={{
          boxShadow:    "0 8px 32px rgba(17,32,28,0.11), 0 2px 8px rgba(17,32,28,0.06)",
          opacity:      open ? 1 : 0,
          transform:    open ? "translateY(0px)" : "translateY(-8px)",
          transition:   "opacity 0.18s ease, transform 0.18s ease",
          pointerEvents:open ? "auto" : "none",
        }}
      >

        {/* User header */}
        <div className="flex items-center gap-3 px-4 py-3 mb-1 border-b border-[var(--color-surface-3)]">
          <UserAvatar name={user.name} email={user.email} size="md" />
          <div className="min-w-0 flex-1">
            {user.name && (
              <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate leading-tight">
                {user.name}
              </p>
            )}
            <p className="text-[11px] text-[var(--color-subtle)] truncate leading-tight mt-0.5">
              {user.email}
            </p>
          </div>
        </div>

        {/* Navigation items */}
        <div className="px-1.5 pt-0.5">
          <DropdownItem icon={User2}           label={L.profile}   href="/profile"             />
          {hasBusiness
            ? <DropdownItem icon={LayoutDashboard} label={L.dashboard} href="/dashboard"           />
            : <DropdownItem icon={Store}           label={L.business}  href="/onboarding"          />
          }
          <DropdownItem icon={Settings2}       label={L.settings}  href="/dashboard/settings"  />
        </div>

        {/* Divider */}
        <div className="mx-3 my-1.5 border-t border-[var(--color-surface-3)]" />

        {/* Logout */}
        <div className="px-1.5 pb-0.5">
          <DropdownItem icon={LogOut} label={L.logout} onClick={handleLogout} danger />
        </div>

      </div>
    </div>
  );
}
