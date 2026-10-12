"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/hooks/useMounted";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Centred dialog, or a sheet that slides from the inline edge on
 * desktop and from the bottom on a phone — which is where a thumb can
 * reach it.
 *
 * Handles the things a hand-rolled overlay usually forgets: Escape to
 * close, a focus trap, restoring focus to whatever opened it, locking
 * the background from scrolling, and labelling itself for screen
 * readers.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "dialog",
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "dialog" | "sheet";
  size?: "sm" | "md" | "lg";
}) {
  const mounted = useMounted();
  const { lang } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // Callers pass inline arrow functions, so onClose is a new function on
  // every render of the parent. Were it a dependency of the effect below,
  // each parent re-render while open — a filter tap, a router.push —
  // would tear the dialog down and set it up again: focus restored to the
  // opener behind the overlay, then moved to the first control (the close
  // button). On a phone that drops the keyboard after every keystroke
  // that commits. Read it through a ref so setup runs once per opening.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);

    // Move focus in once the panel has mounted.
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      panel?.querySelector<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(id);
      restoreTo.current?.focus?.();
    };
  }, [open]);

  if (!open || !mounted) return null;

  const width = { sm: "max-w-[26rem]", md: "max-w-[34rem]", lg: "max-w-[48rem]" }[size];

  const panel =
    variant === "sheet"
      ? cn(
          "w-full sm:h-full sm:max-w-[28rem]",
          "rounded-t-[var(--radius-2xl)] sm:rounded-none sm:rounded-s-[var(--radius-2xl)]",
          "max-h-[92vh] sm:max-h-none",
        )
      : cn("w-full rounded-[var(--radius-xl)] max-h-[92vh]", width);

  const position =
    variant === "sheet"
      ? "items-end justify-center sm:items-stretch sm:justify-end"
      : "items-center justify-center p-4";

  return createPortal(
    <div className={cn("fixed inset-0 z-[100] flex", position)}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[rgb(17_32_28/0.45)] backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? "modal-desc" : undefined}
        className={cn(
          "relative z-10 flex flex-col overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-modal)]",
          panel,
        )}
      >
        <div className="flex shrink-0 items-start gap-4 border-b border-[var(--color-line)] px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="m-0 text-[1.125rem] font-bold text-[var(--color-ink)]">
              {title}
            </h2>
            {description && (
              <p id="modal-desc" className="m-0 mt-1.5 text-[0.8125rem] text-[var(--color-subtle)]">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={lang === "ar" ? "إغلاق" : "Close"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-3)] text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            <X size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-[var(--color-line)] px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
