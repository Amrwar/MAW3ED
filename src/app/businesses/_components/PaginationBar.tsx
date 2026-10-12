"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageWindow } from "@/lib/discovery/params";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  pageCount: number;
  /** Real href for every control, so each page is crawlable and openable in a new tab. */
  hrefFor: (page: number) => string;
  onNavigate: (page: number) => void;
}

/**
 * Numbered pages.
 *
 * Every control is a real link with a real address — middle-click and
 * "open in new tab" work, and a crawler can walk the set — with a click
 * handler on top so an ordinary click goes through the router instead
 * of reloading the document.
 *
 * The chevrons follow the reading direction: in Arabic, "next" points
 * left.
 */
export default function PaginationBar({ page, pageCount, hrefFor, onNavigate }: Props) {
  const { t, lang } = useLanguage();
  const b = t.businesses;
  const isAr = lang === "ar";

  const PrevIcon = isAr ? ChevronRight : ChevronLeft;
  const NextIcon = isAr ? ChevronLeft : ChevronRight;

  const items = pageWindow(page, pageCount);

  function go(e: React.MouseEvent, target: number) {
    // Leave the modified clicks to the browser.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(target);
  }

  return (
    <nav aria-label={b.pagination} className="flex flex-wrap items-center justify-center gap-1.5">
      <Link
        href={hrefFor(Math.max(1, page - 1))}
        onClick={(e) => (page === 1 ? e.preventDefault() : go(e, page - 1))}
        aria-disabled={page === 1}
        rel="prev"
        className={cn(
          "flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 text-[0.875rem] font-bold transition-colors",
          page === 1
            ? "pointer-events-none text-[var(--color-subtle)]"
            : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]",
        )}
      >
        <PrevIcon size={16} strokeWidth={2.2} aria-hidden="true" />
        {b.previous}
      </Link>

      {items.map((item, i) =>
        item === "gap" ? (
          <span
            key={`gap-${i}`}
            aria-hidden="true"
            className="flex min-h-11 w-8 items-center justify-center text-[var(--color-subtle)]"
          >
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            onClick={(e) => go(e, item)}
            aria-current={item === page ? "page" : undefined}
            aria-label={`${b.page} ${num(item, lang)}`}
            className={cn(
              "num flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] px-2 text-[0.875rem] transition-colors",
              item === page
                ? "bg-[var(--color-jade)] font-bold text-[var(--color-inverse)]"
                : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]",
            )}
          >
            {num(item, lang)}
          </Link>
        ),
      )}

      <Link
        href={hrefFor(Math.min(pageCount, page + 1))}
        onClick={(e) => (page === pageCount ? e.preventDefault() : go(e, page + 1))}
        aria-disabled={page === pageCount}
        rel="next"
        className={cn(
          "flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] px-3.5 text-[0.875rem] font-bold transition-colors",
          page === pageCount
            ? "pointer-events-none text-[var(--color-subtle)]"
            : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]",
        )}
      >
        {b.next}
        <NextIcon size={16} strokeWidth={2.2} aria-hidden="true" />
      </Link>
    </nav>
  );
}
