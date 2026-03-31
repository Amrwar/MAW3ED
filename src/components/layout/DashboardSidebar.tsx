"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Settings,
  Store,
  BarChart3,
  Users,
  MessageSquare,
  HelpCircle,
  LogOut,
} from "lucide-react";
import Logo from "@/components/shared/Logo";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "الرئيسية",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "المواعيد",
    icon: CalendarDays,
    href: "/dashboard/bookings",
    badge: "12",
  },
  {
    label: "الخدمات",
    icon: Store,
    href: "/dashboard/services",
  },
  {
    label: "العملاء",
    icon: Users,
    href: "/dashboard/customers",
  },
  {
    label: "الإحصائيات",
    icon: BarChart3,
    href: "/dashboard/analytics",
  },
  {
    label: "التقييمات",
    icon: MessageSquare,
    href: "/dashboard/reviews",
  },
  {
    label: "الإعدادات",
    icon: Settings,
    href: "/dashboard/settings",
  },
];

const bottomItems = [
  { label: "المساعدة", icon: HelpCircle, href: "/help" },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

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
            ب س
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              صالون بيلا
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">الزمالك، القاهرة</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--color-brand)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <item.icon size={17} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full font-medium",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-accent-light)] text-[var(--color-accent)]"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-[var(--color-border)] space-y-0.5">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <item.icon size={17} />
            {item.label}
          </Link>
        ))}
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors">
          <LogOut size={17} />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
