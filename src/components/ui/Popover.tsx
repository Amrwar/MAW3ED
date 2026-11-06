"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * A panel opened from a trigger, drawn at the end of <body> and placed
 * under the trigger with fixed coordinates.
 *
 * Portalled because its triggers live in a row that scrolls sideways
 * (the Browse filter bar): an overflow container clips anything
 * absolutely positioned inside it, so an in-place panel would be cut
 * off at the row's edge. Kept inside the viewport on both sides, and
 * mirrored for RTL by anchoring to the trigger's start edge.
 *
 * Closes on Escape and on a pointer press outside both the trigger and
 * the panel, and returns focus to the trigger.
 */
export default function Popover({
  open,
  onClose,
  anchor,
  label,
  width = 18,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** The element the panel hangs from. */
  anchor: HTMLElement | null;
  label: string;
  /** In rem. Capped to the viewport less a margin. */
  width?: number;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Placed by writing the panel's style directly: it is measured from
  // the DOM after layout, and a state round-trip would render it once
  // in the wrong place first.
  const place = useCallback(() => {
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const r = anchor.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const margin = 12;
    const vw = window.innerWidth;
    const w = Math.min(width * rem, vw - margin * 2);
    const rtl = document.documentElement.dir === "rtl";
    // Start-aligned with the trigger, then pulled back inside the screen.
    let left = rtl ? r.right - w : r.left;
    left = Math.max(margin, Math.min(left, vw - margin - w));
    const top = r.bottom + 8;
    Object.assign(panel.style, {
      top: `${top}px`,
      left: `${left}px`,
      width: `${w}px`,
      maxHeight: `${Math.max(160, window.innerHeight - top - margin)}px`,
      visibility: "visible",
    });
  }, [anchor, width]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Focus moves into the panel: it sits at the end of <body>, so a
    // keyboard user would otherwise Tab on past it to the next control.
    panelRef.current
      ?.querySelector<HTMLElement>("button:not([disabled]), input, a[href]")
      ?.focus();
  }, [open, place]);

  /**
   * Close, but first let a field inside finish: unmounting the panel
   * skips its blur, and a price typed without Enter commits on blur.
   */
  const closeNow = useCallback(() => {
    const active = document.activeElement as HTMLElement | null;
    if (active && panelRef.current?.contains(active)) active.blur();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchor?.contains(t)) return;
      closeNow();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeNow();
        anchor?.focus();
        return;
      }
      // Tab stays inside the panel while it is open.
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input, a[href]"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // The trigger moves when the page or its row scrolls; follow it.
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, closeNow, anchor, place]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      // Hidden until placed, so it never flashes at the corner.
      style={{ top: 0, left: 0, visibility: "hidden" }}
      className={cn(
        // Under the fixed header (z-50) when the page scrolls it there.
        "animate-dropdown-in fixed z-40 flex flex-col overflow-hidden",
        "rounded-[var(--radius-lg)] border border-[var(--color-line)]",
        "bg-[var(--color-surface)] shadow-[var(--shadow-dropdown)]",
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
