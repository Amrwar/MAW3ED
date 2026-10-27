"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "@/components/shared/LocaleLink";
import { cn } from "@/lib/utils";

/**
 * Menu anchored to a trigger.
 *
 * Closes on outside pointerdown and on Escape, returns focus to the
 * trigger, and anchors to the inline start or end so it mirrors
 * correctly rather than flying off-screen in Arabic.
 *
 * Deliberately no scale transform: transform-origin does not mirror
 * under RTL, so a scaled panel grows from the wrong corner.
 */
export default function Dropdown({
  trigger,
  children,
  align = "end",
  width = "14rem",
  label,
  role = "menu",
  closeOnClick = true,
}: {
  /** Receives the open state so the trigger can show it. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  width?: string;
  label: string;
  /**
   * "menu" for a list of commands. A panel holding anything else — a
   * notification feed, a form — is a "group": calling it a menu while
   * its children are not menu items misreports the structure.
   */
  role?: "menu" | "group";
  /** A menu closes when a row is picked; a panel usually should not. */
  closeOnClick?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>("button")?.focus();
      }
    }

    // pointerdown, not click: a click listener fires after the trigger's
    // own handler and immediately reopens the menu.
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}

      {open && (
        <div
          role={role}
          aria-label={label}
          style={{ width }}
          onClick={closeOnClick ? () => setOpen(false) : undefined}
          className={cn(
            "animate-dropdown-in absolute top-[calc(100%+0.5rem)] z-50 overflow-hidden",
            "rounded-[var(--radius-lg)] border border-[var(--color-line)]",
            "bg-[var(--color-surface)] py-1.5 shadow-[var(--shadow-dropdown)]",
            align === "end" ? "end-0" : "start-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** One row in a dropdown. Renders as a link when given an href. */
export function DropdownItem({
  icon,
  children,
  onClick,
  href,
  tone = "default",
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "danger";
}) {
  const className = cn(
    "flex min-h-11 w-full items-center gap-3 px-4 text-start text-[0.875rem] transition-colors",
    tone === "danger"
      ? "text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
      : "text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]",
  );

  const body = (
    <>
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0",
            // A danger row's icon inherits the row's colour; a normal
            // one stays quieter than its label.
            tone === "danger" ? "text-current" : "text-[var(--color-subtle)]",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );

  // next/link, not a bare anchor: a menu row that navigates should not
  // reload the whole app.
  if (href) {
    return (
      <Link role="menuitem" href={href} onClick={onClick} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button role="menuitem" type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

export function DropdownDivider() {
  return <div aria-hidden="true" className="my-1.5 h-px bg-[var(--color-line)]" />;
}
