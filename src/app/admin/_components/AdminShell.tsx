"use client";

import Link from "@/components/shared/LocaleLink";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import type { AdminNavSection } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

/**
 * The frame around every admin page.
 *
 * Deliberately plain and deliberately different from the business
 * dashboard: somebody acting on other people's data should be able to
 * tell at a glance that is what they are doing.
 */
export default function AdminShell({
  sections,
  actorName,
  roleLabel,
  children,
}: {
  sections: AdminNavSection[];
  actorName: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-[var(--color-ground)]" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-night)]">
        <div className="container-app flex h-14 items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-[0.9375rem] font-bold text-white">
            <ShieldCheck size={17} aria-hidden="true" className="text-[var(--color-jade)]" />
            لوحة الإدارة
          </span>
          <span className="text-[0.75rem] text-[var(--color-night-subtle)]">
            {actorName} ·{" "}
            <span className="rounded-full bg-[var(--color-jade)] px-2 py-0.5 font-bold text-white">
              {roleLabel}
            </span>
          </span>
        </div>
      </header>

      <div className="container-app flex flex-col gap-7 py-7 lg:flex-row">
        <nav className="lg:w-[13rem] lg:shrink-0" aria-label="أقسام الإدارة">
          {sections.map((section) => (
            <div key={section.titleAr ?? "main"} className="mb-4">
              {section.titleAr && (
                <p className="m-0 px-3 pb-1 text-[0.625rem] font-bold uppercase tracking-wider text-[var(--color-subtle)]">
                  {section.titleAr}
                </p>
              )}
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center rounded-[var(--radius-sm)] px-3 text-[0.84375rem] transition-colors",
                        isActive(item.href)
                          ? "bg-[var(--color-jade)] font-bold text-white"
                          : "text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]",
                      )}
                    >
                      {item.labelAr}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main id="main" className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
