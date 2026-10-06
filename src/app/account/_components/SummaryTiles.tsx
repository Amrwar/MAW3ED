"use client";

import Link from "next/link";
import { Bell, CalendarClock, Heart, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";

interface Props {
  summary: { upcoming: number; total: number; favorites: number; unread: number };
}

/** The four numbers worth leading with, each a way into its section. */
export default function SummaryTiles({ summary }: Props) {
  const { t, lang } = useLanguage();
  const s = t.account.summary;

  const tiles = [
    { href: "/account/upcoming", icon: CalendarClock, value: summary.upcoming, label: s.upcoming },
    { href: "/account/history", icon: Star, value: summary.total, label: s.total },
    { href: "/account/favorites", icon: Heart, value: summary.favorites, label: s.favorites },
    { href: "/account/notifications", icon: Bell, value: summary.unread, label: t.account.nav.notifications },
  ];

  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className="card card-hover flex min-h-[5.5rem] flex-col justify-between p-4"
            >
              <Icon
                size={17}
                strokeWidth={1.8}
                aria-hidden="true"
                className="text-[var(--color-jade)]"
              />
              <span>
                <span className="num block text-[1.375rem] font-bold leading-none text-[var(--color-ink)]">
                  {num(tile.value, lang)}
                </span>
                <span className="mt-1 block text-[0.75rem] text-[var(--color-subtle)]">
                  {tile.label}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
