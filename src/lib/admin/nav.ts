import type { AdminRole } from "@prisma/client";
import { canAny, type Permission } from "./permissions";

/**
 * The admin navigation.
 *
 * Each entry declares the permissions it needs and the nav is filtered
 * by the same `can` the routes use — so the menu cannot offer a page
 * that then 404s, and cannot hide one somebody is allowed to open.
 *
 * Hiding a link is not security and is not treated as any. Every page
 * behind these links guards itself; this only decides what is worth
 * showing somebody.
 *
 * Sections the brief asked for that are not here — Coupons, Support,
 * Content — have no data behind them. A nav entry for a feature that
 * does not exist is a promise the panel cannot keep.
 */

export interface AdminNavItem {
  href: string;
  labelAr: string;
  labelEn: string;
  /** Visible when the role has any one of these. */
  permissions: readonly Permission[];
}

export interface AdminNavSection {
  titleAr: string | null;
  titleEn: string | null;
  items: AdminNavItem[];
}

const SECTIONS: AdminNavSection[] = [
  {
    titleAr: null,
    titleEn: null,
    items: [
      {
        href: "/admin",
        labelAr: "نظرة عامة",
        labelEn: "Overview",
        // Everybody with any admin role gets a landing page; what is on
        // it is filtered per permission.
        permissions: ["reviews.read", "businesses.read", "payments.read"],
      },
    ],
  },
  {
    titleAr: "المنصة",
    titleEn: "Platform",
    items: [
      {
        href: "/admin/businesses",
        labelAr: "الأعمال",
        labelEn: "Businesses",
        permissions: ["businesses.read"],
      },
      {
        href: "/admin/verification",
        labelAr: "التوثيق",
        labelEn: "Verification",
        permissions: ["businesses.verify"],
      },
      {
        href: "/admin/reviews",
        labelAr: "التقييمات",
        labelEn: "Reviews",
        permissions: ["reviews.read"],
      },
      {
        href: "/admin/customers",
        labelAr: "العملاء",
        labelEn: "Customers",
        permissions: ["customers.read"],
      },
      {
        href: "/admin/waitlist",
        labelAr: "قائمة الانتظار",
        labelEn: "Waitlist",
        permissions: ["customers.read"],
      },
      {
        href: "/admin/bookings",
        labelAr: "الحجوزات",
        labelEn: "Bookings",
        permissions: ["bookings.read"],
      },
    ],
  },
  {
    titleAr: "الكتالوج",
    titleEn: "Catalogue",
    items: [
      {
        href: "/admin/categories",
        labelAr: "التصنيفات",
        labelEn: "Categories",
        permissions: ["catalogue.read"],
      },
      {
        href: "/admin/cities",
        labelAr: "المدن",
        labelEn: "Cities",
        permissions: ["catalogue.read"],
      },
      {
        href: "/admin/services",
        labelAr: "الخدمات",
        labelEn: "Services",
        permissions: ["catalogue.read"],
      },
    ],
  },
  {
    titleAr: "المال",
    titleEn: "Money",
    items: [
      {
        href: "/admin/subscriptions",
        labelAr: "الاشتراكات",
        labelEn: "Subscriptions",
        permissions: ["subscriptions.read"],
      },
      {
        href: "/admin/payments",
        labelAr: "المدفوعات",
        labelEn: "Payments",
        permissions: ["payments.read"],
      },
    ],
  },
  {
    titleAr: "التشغيل",
    titleEn: "Operations",
    items: [
      {
        href: "/admin/notifications",
        labelAr: "الإشعارات",
        labelEn: "Notifications",
        permissions: ["notifications.read"],
      },
      {
        href: "/admin/reports",
        labelAr: "التقارير",
        labelEn: "Reports",
        permissions: ["reports.read"],
      },
      {
        href: "/admin/audit",
        labelAr: "سجل النشاط",
        labelEn: "Audit log",
        permissions: ["audit.read"],
      },
      {
        href: "/admin/settings",
        labelAr: "إعدادات النظام",
        labelEn: "System settings",
        permissions: ["settings.manage"],
      },
    ],
  },
];

/** The sections this role may see, with empty ones dropped. */
export function adminNavFor(role: AdminRole): AdminNavSection[] {
  return SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => canAny(role, i.permissions)),
  })).filter((s) => s.items.length > 0);
}

/** Every admin path the nav knows about, for tests and for the guard audit. */
export function allAdminPaths(): { href: string; permissions: readonly Permission[] }[] {
  return SECTIONS.flatMap((s) =>
    s.items.map((i) => ({ href: i.href, permissions: i.permissions })),
  );
}
