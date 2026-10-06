"use client";

import { cn } from "@/lib/utils";

/**
 * A switch with a label and a line of explanation.
 *
 * The whole row is the label, so the tap target is the row rather than
 * a 40px switch — which matters most on the phone, where most of these
 * are read. The checkbox itself stays in the accessibility tree.
 */
export default function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-[var(--radius-md)] px-2 py-2.5 transition-colors",
        disabled
          ? "cursor-not-allowed opacity-55"
          : "cursor-pointer hover:bg-[var(--color-surface-2)]",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-[var(--color-jade)]" : "bg-[var(--color-line-2)]",
        )}
      >
        <span
          className={cn(
            "block h-5 w-5 rounded-full bg-[var(--color-surface)] transition-transform",
            checked ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.875rem] font-bold text-[var(--color-ink)]">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[0.78125rem] leading-relaxed text-[var(--color-subtle)]">
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
