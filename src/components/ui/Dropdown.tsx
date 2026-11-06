"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/shared/LocaleLink";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
 *
 * With `sheetOnPhone`, below 640px the panel is a bottom sheet over a
 * dimmed page instead: a 15rem popover hanging off a 390px screen's
 * corner is cramped and easy to miss. The sheet is portalled to the
 * body, since an ancestor with a backdrop-filter (the header) would
 * otherwise become its containing block and pin it inside the bar.
 */
export default function Dropdown({
  trigger,
  children,
  align = "end",
  width = "14rem",
  label,
  role = "menu",
  closeOnClick = true,
  sheetOnPhone = false,
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
  /** A bottom sheet below 640px rather than a popover. */
  sheetOnPhone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isPhone = useMediaQuery(sheetOnPhone ? "(max-width: 639.98px)" : null);
  const asSheet = sheetOnPhone && isPhone;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLElement>("button")?.focus();
      }
    }

    // pointerdown, not click: a click listener fires after the trigger's
    // own handler and immediately reopens the menu. Not for the sheet:
    // its backdrop covers the page and closes it on its own click, so
    // the tap that closes it does not also land on what was underneath.
    if (!asSheet) document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, asSheet]);

  // The sheet is modal: the page behind it does not scroll, focus moves
  // into it, and Tab stays inside it until it closes.
  useEffect(() => {
    if (!open || !asSheet) return;
    const panel = panelRef.current;
    const items = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
    items()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);

    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Only undo our own lock: another component may have set its own
      // while the sheet was open.
      if (body.style.overflow === "hidden") body.style.overflow = prevOverflow;
    };
  }, [open, asSheet]);

  const close = closeOnClick ? () => setOpen(false) : undefined;

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}

      {open && asSheet &&
        createPortal(
          // touch-action: none, so a drag on the backdrop does not scroll
          // the page behind it on iOS, where overflow: hidden alone does not.
          <div className="fixed inset-0 z-[100] flex items-end touch-none">
            <div
              aria-hidden="true"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-[rgb(17_32_28/0.45)] backdrop-blur-[2px]"
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={label}
              className="relative w-full touch-auto"
            >
            <div
              role={role}
              aria-label={label}
              onClick={close}
              className={cn(
                "animate-sheet-in relative w-full overflow-hidden",
                "rounded-t-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]",
                "pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
              )}
            >
              <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 rounded-full bg-[var(--color-line)]" />
              {children}
            </div>
            </div>
          </div>,
          document.body,
        )}

      {open && !asSheet && (
        <div
          ref={panelRef}
          role={role}
          aria-label={label}
          style={{ width }}
          onClick={close}
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
