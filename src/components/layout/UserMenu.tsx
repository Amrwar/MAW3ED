"use client";

import { signOut } from "next-auth/react";
import {
  User2,
  LayoutDashboard,
  Settings2,
  LogOut,
  Bell,
  ChevronDown,
  Store,
  CalendarClock,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import Dropdown, { DropdownItem, DropdownDivider } from "@/components/ui/Dropdown";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────

export interface NavUser {
  id:          string;
  /** Absent for a customer who signed in with a phone and no address. */
  email?:      string | null;
  name?:       string | null;
  phone?:      string | null;
  businessId?: string | null;
  adminRole?:  string | null;
}

/**
 * A customer: signed in with a verified phone, with no business and no
 * admin role. They have an account area and nothing else — offering
 * them "My business" or the dashboard's settings sends them into
 * business onboarding, which is not what they came for.
 */
export function isCustomerUser(user: NavUser): boolean {
  return !user.businessId && !user.adminRole && !!user.phone;
}

// ─── Helpers ───────────────────────────────────────────────

function getInitials(name?: string | null, email?: string | null): string {
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
  email?:  string | null;
  size?:   "sm" | "md" | "lg";
}) {
  const dims = { sm: "w-7 h-7 text-[10px]", md: "w-9 h-9 text-sm", lg: "w-11 h-11 text-base" };

  return (
    <div
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full",
        "bg-[var(--color-jade)] font-bold text-[var(--color-inverse)]",
        dims[size],
      )}
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
      className="relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-subtle)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-muted)]"
    >
      <Bell size={17} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}

// ─── UserMenu ──────────────────────────────────────────────

interface UserMenuProps {
  user: NavUser;
}

export function UserMenu({ user }: UserMenuProps) {
  const { lang } = useLanguage();

  async function handleLogout() {
    await signOut({ callbackUrl: "/" });
  }

  const hasBusiness = !!user.businessId;
  const isCustomer  = isCustomerUser(user);

  const L = {
    menu:      lang === "ar" ? "قائمة المستخدم" : "User menu",
    account:   lang === "ar" ? "حجوزاتي" : "My bookings",
    profile:   lang === "ar" ? "بياناتي" : "Profile",
    dashboard: lang === "ar" ? "لوحة التحكم"  : "Dashboard",
    business:  lang === "ar" ? "إدارة نشاطي"   : "My Business",
    settings:  lang === "ar" ? "الإعدادات"     : "Settings",
    logout:    lang === "ar" ? "تسجيل الخروج"  : "Sign out",
  };

  return (
    <Dropdown
      label={L.menu}
      align="end"
      width="15rem"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={L.menu}
          className={cn(
            "flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] px-1.5 outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-[var(--color-jade)] focus-visible:ring-offset-1",
            open ? "bg-[var(--color-surface-3)]" : "hover:bg-[var(--color-surface-2)]",
          )}
        >
          <UserAvatar name={user.name} email={user.email} size="md" />
          <ChevronDown
            size={14}
            strokeWidth={2.5}
            aria-hidden="true"
            className={cn(
              "text-[var(--color-subtle)] transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      )}
    >
      {/* Who is signed in — the menu's own header, not a menu item. */}
      <div className="mb-1 flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-3">
        <UserAvatar name={user.name} email={user.email} size="md" />
        <div className="min-w-0 flex-1">
          {user.name && (
            <p className="m-0 truncate text-[0.8125rem] font-bold leading-tight text-[var(--color-ink)]">
              {user.name}
            </p>
          )}
          <p className="m-0 mt-0.5 truncate text-[0.6875rem] leading-tight text-[var(--color-subtle)]">
            {user.email}
          </p>
        </div>
      </div>

      <DropdownItem icon={<CalendarClock size={15} strokeWidth={1.8} />} href="/account">
        {L.account}
      </DropdownItem>

      <DropdownItem icon={<User2 size={15} strokeWidth={1.8} />} href="/account/profile">
        {L.profile}
      </DropdownItem>

      {hasBusiness ? (
        <DropdownItem icon={<LayoutDashboard size={15} strokeWidth={1.8} />} href="/dashboard">
          {L.dashboard}
        </DropdownItem>
      ) : isCustomer ? null : (
        <DropdownItem icon={<Store size={15} strokeWidth={1.8} />} href="/onboarding">
          {L.business}
        </DropdownItem>
      )}

      <DropdownItem
        icon={<Settings2 size={15} strokeWidth={1.8} />}
        href={hasBusiness ? "/dashboard/settings" : "/account/settings"}
      >
        {L.settings}
      </DropdownItem>

      <DropdownDivider />

      <DropdownItem icon={<LogOut size={15} strokeWidth={1.8} />} onClick={handleLogout} tone="danger">
        {L.logout}
      </DropdownItem>
    </Dropdown>
  );
}
