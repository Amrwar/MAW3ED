"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { num } from "@/lib/fmt";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Builds a window of page numbers with ellipses, always showing the
 * first and last page and a run around the current one.
 */
function pagesFor(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const out: (number | "gap")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(total - 1, page + 1);

  if (from > 2) out.push("gap");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("gap");

  out.push(total);
  return out;
}

/**
 * Previous/next chevrons point towards the page they lead to, so they
 * swap under RTL — the control reads correctly in both directions
 * rather than mirroring the visual order of the numbers.
 */
export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const { lang } = useLanguage();
  if (totalPages <= 1) return null;

  const isAr = lang === "ar";
  const PrevIcon = isAr ? ChevronRight : ChevronLeft;
  const NextIcon = isAr ? ChevronLeft : ChevronRight;

  const box =
    "flex h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] border text-[0.875rem] transition-colors";

  return (
    <nav
      aria-label={isAr ? "تنقل بين الصفحات" : "Pagination"}
      className={cn("flex flex-wrap items-center justify-center gap-2", className)}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={isAr ? "الصفحة السابقة" : "Previous page"}
        className={cn(
          box,
          "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]",
          "disabled:cursor-not-allowed disabled:text-[var(--color-faint)]",
        )}
      >
        <PrevIcon size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      {pagesFor(page, totalPages).map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-[var(--color-faint)]">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              box,
              "num px-3",
              p === page
                ? "border-[var(--color-night)] bg-[var(--color-night)] font-bold text-white"
                : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {num(p, lang)}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={isAr ? "الصفحة التالية" : "Next page"}
        className={cn(
          box,
          "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]",
          "disabled:cursor-not-allowed disabled:text-[var(--color-faint)]",
        )}
      >
        <NextIcon size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </nav>
  );
}
