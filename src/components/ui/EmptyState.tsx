import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * An empty state always names the next action. "No bookings yet" on
 * its own tells the owner nothing they can act on.
 */
export default function EmptyState({
  icon,
  title,
  body,
  action,
  tone = "neutral",
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "neutral" | "jade" | "warn";
  className?: string;
}) {
  const toneRing =
    tone === "jade"
      ? "bg-[var(--color-jade-soft)] text-[var(--color-jade)]"
      : tone === "warn"
        ? "bg-[var(--color-warn-soft)] text-[var(--color-warn)]"
        : "bg-[var(--color-surface-3)] text-[var(--color-muted)]";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center gap-3 px-6 py-14",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "mb-1 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)]",
            toneRing,
          )}
        >
          {icon}
        </span>
      )}
      <h3 className="text-base font-bold text-[var(--color-ink)]">{title}</h3>
      {body && (
        <p className="max-w-[40ch] text-sm leading-relaxed text-[var(--color-subtle)]">
          {body}
        </p>
      )}
      {action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
