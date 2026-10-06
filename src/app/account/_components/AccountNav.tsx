"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Bell,
  CalendarClock,
  CreditCard,
  Heart,
  History,
  LayoutGrid,
  LogOut,
  Settings,
  Star,
  User2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

interface Props {
  /** Shown on the notifications row so it is visible without opening it. */
  unread: number;
}

/**
 * The account's own navigation.
 *
 * A sidebar on a wide screen, a scrolling strip of tabs on a phone —
 * the same list either way, because a customer should not have to learn
 * two different shapes of the same menu.
 */
export default function AccountNav({ unread }: Props) {
  const { t, lang } = useLanguage();
  const n = t.account.nav;
  const pathname = usePathname();

  const items = [
    { href: "/account", label: n.overview, icon: LayoutGrid, badge: 0 },
    { href: "/account/upcoming", label: n.upcoming, icon: CalendarClock, badge: 0 },
    { href: "/account/history", label: n.history, icon: History, badge: 0 },
    { href: "/account/favorites", label: n.favorites, icon: Heart, badge: 0 },
    { href: "/account/reviews", label: n.reviews, icon: Star, badge: 0 },
    { href: "/account/notifications", label: n.notifications, icon: Bell, badge: unread },
    { href: "/account/profile", label: n.profile, icon: User2, badge: 0 },
    { href: "/account/payments", label: n.payments, icon: CreditCard, badge: 0 },
    { href: "/account/settings", label: n.settings, icon: Settings, badge: 0 },
  ];

  const isActive = (href: string) =>
    href === "/account" ? pathname === "/account" : pathname.startsWith(href);

  return (
    <nav aria-label={t.account.title}>
      {/* Phone: one scrolling row, no wrapping into three lines. */}
      <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[0.8125rem] transition-colors",
                isActive(item.href)
                  ? "border-[var(--color-jade)] bg-[var(--color-jade-soft)] font-bold text-[var(--color-ok)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {item.label}
              {item.badge > 0 && (
                <span className="num rounded-full bg-[var(--color-danger)] px-1.5 text-[0.625rem] font-bold text-[var(--color-inverse)]">
                  {num(item.badge, lang)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {/* Wide: a column. */}
      <ul className="m-0 hidden list-none flex-col gap-0.5 p-0 lg:flex">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-3 text-[0.875rem] transition-colors",
                  active
                    ? "bg-[var(--color-jade-soft)] font-bold text-[var(--color-ok)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]",
                )}
              >
                <Icon size={16} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge > 0 && (
                  <span className="num shrink-0 rounded-full bg-[var(--color-danger)] px-1.5 text-[0.625rem] font-bold text-[var(--color-inverse)]">
                    {num(item.badge, lang)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}

        <li className="mt-2 border-t border-[var(--color-line)] pt-2">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] px-3 text-[0.875rem] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
          >
            <LogOut size={16} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />
            {t.account.signOut}
          </button>
        </li>
      </ul>
    </nav>
  );
}
