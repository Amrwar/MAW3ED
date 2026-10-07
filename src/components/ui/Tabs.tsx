"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Shown as a count chip beside the label. */
  badge?: number;
}

/**
 * Segmented control. Keyboard support follows the WAI-ARIA tabs
 * pattern: arrow keys move between tabs, and Home/End jump to the
 * ends. Arrow direction is swapped under RTL so Left still means
 * "towards the visual left".
 */
export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = "pill",
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for assistive tech. */
  label: string;
  variant?: "pill" | "underline";
  className?: string;
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    const i = items.findIndex((t) => t.value === value);
    if (i === -1) return;

    const rtl =
      typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";

    let next: number | null = null;
    if (e.key === back) next = (i - 1 + items.length) % items.length;
    else if (e.key === fwd) next = (i + 1) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;

    if (next !== null) {
      e.preventDefault();
      onChange(items[next].value);
    }
  }

  if (variant === "underline") {
    return (
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={cn("flex gap-7 border-b border-[var(--color-line)]", className)}
      >
        {items.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.value)}
              className={cn(
                "-mb-px min-h-11 border-b-2 px-0.5 text-[0.90625rem] transition-colors",
                active
                  ? "border-[var(--color-jade)] font-bold text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex max-w-full flex-wrap gap-1 rounded-full bg-[var(--color-surface-3)] p-1",
        className,
      )}
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "flex h-11 items-center gap-2 rounded-full px-4 text-[0.84375rem] transition-colors",
              active
                ? "bg-[var(--color-surface)] font-bold text-[var(--color-ink)] shadow-[var(--shadow-card)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className="num rounded-full bg-[var(--color-surface-2)] px-1.5 text-[0.6875rem] font-bold">
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
