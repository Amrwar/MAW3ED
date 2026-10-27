"use client";

import { CalendarPlus, Eye, BarChart3, Settings, ChevronLeft } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props { slug: string }

const ACTION_ICONS = [CalendarPlus, Eye, BarChart3, Settings];
const ACTION_HREFS = ["/dashboard/bookings", "", "/dashboard/analytics", "/dashboard/settings"];

export default function QuickActions({ slug }: Props) {
  const { t } = useLanguage();
  const qa = t.dashboard.quickActions;

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-line)] px-5 py-4">
        <h2 className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">{qa.title}</h2>
      </div>

      <ul className="flex flex-col">
        {qa.actions.map((action, i) => {
          const isExternal = i === 1;
          const href = isExternal ? `/company/${slug}` : ACTION_HREFS[i];
          const Icon = ACTION_ICONS[i];

          return (
            <li key={action.label} className="border-b border-[var(--color-line)] last:border-b-0">
              <Link
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="group flex items-center gap-3.5 px-5 py-3.5 text-[var(--color-ink)] transition-colors hover:bg-[var(--color-surface-2)]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-jade-soft)] text-[var(--color-jade)]"
                >
                  <Icon size={16} strokeWidth={1.8} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] font-bold leading-snug text-[var(--color-ink)]">
                    {action.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--color-subtle)]">
                    {action.desc}
                  </span>
                </span>

                <ChevronLeft
                  size={15}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-subtle)] transition-transform group-hover:-translate-x-0.5"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
