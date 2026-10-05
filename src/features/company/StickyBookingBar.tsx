"use client";

import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { OpenState } from "@/lib/discovery/hours";
import { useLanguage } from "@/contexts/LanguageContext";
import { money } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { liveElementById } from "@/lib/live-element";

interface Props {
  /** null when no service has a price set — never rendered as zero. */
  minPrice: number | null;
  currency: string;
  open: OpenState;
  /**
   * The element the bar stands in for. While it is on screen the bar
   * stays hidden: two "book now" buttons a thumb apart is clutter, and
   * at rest on a short phone the bar lands on top of the section tabs.
   */
  watchId?: string;
}

/**
 * The booking call to action, pinned to the bottom on a phone.
 *
 * Small screens only — the sidebar widget never leaves the viewport on
 * a wide layout, so a second fixed bar there would cover content for no
 * gain. The page reserves height for it (pb-32 on the content) so it
 * never hides the last row of a section.
 */
export default function StickyBookingBar({ minPrice, currency, open, watchId }: Props) {
  const { t, lang } = useLanguage();
  const p = t.profile;

  // null until the observer has reported. Keeping the "not yet known"
  // case distinct is what lets the bar start hidden without setting
  // state from inside the effect.
  const [heroVisible, setHeroVisible] = useState<boolean | null>(null);

  useEffect(() => {
    const target = watchId ? liveElementById(watchId) : null;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);

  // With nothing to stand in for, the bar is simply always there.
  // Before the first report, the sentinel is on screen by definition.
  const shown = heroVisible === null ? !watchId : !heroVisible;

  return (
    <div
      aria-hidden={!shown}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-line)]",
        "bg-[var(--color-surface)]/98 backdrop-blur-md transition-transform duration-200 lg:hidden",
        shown ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
      // Clears the home indicator on a notched phone.
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="container-app flex items-center gap-4 py-3">
        <div className="min-w-0 flex-1">
          {minPrice !== null ? (
            <>
              <p className="m-0 text-[0.6875rem] leading-none text-[var(--color-subtle)]">
                {p.startingFrom}
              </p>
              <p className="num m-0 mt-1.5 truncate text-[1.0625rem] font-extrabold leading-none text-[var(--color-ink)]">
                {money(minPrice, lang, currency)}
              </p>
            </>
          ) : open.state === "open" ? (
            <p className="m-0 flex items-center gap-1.5 text-[0.8125rem] font-bold leading-none text-[var(--color-ok)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)]" />
              {p.openNow}
            </p>
          ) : (
            <p className="m-0 truncate text-[0.8125rem] leading-none text-[var(--color-subtle)]">
              {p.closed}
            </p>
          )}
        </div>

        <a
          href="#booking"
          // Not reachable by keyboard while the bar is off-screen.
          tabIndex={shown ? undefined : -1}
          className="btn btn-primary shrink-0"
        >
          <CalendarPlus size={16} strokeWidth={1.9} aria-hidden="true" />
          {p.bookNow}
        </a>
      </div>
    </div>
  );
}
