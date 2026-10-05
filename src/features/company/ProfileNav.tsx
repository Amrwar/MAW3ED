"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { liveElementById } from "@/lib/live-element";

export interface NavSection {
  id: string;
  label: string;
}

/**
 * The section tabs, pinned under the header.
 *
 * Only sections that actually rendered are passed in, so the bar never
 * offers a link to an empty anchor.
 *
 * The active tab follows the scroll through an IntersectionObserver
 * rather than a scroll handler: the browser does the work off the main
 * thread, and there is no listener firing on every pixel.
 */
export default function ProfileNav({ sections }: { sections: NavSection[] }) {
  const { t } = useLanguage();
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (sections.length === 0) return;

    const seen = new Map<string, number>();

    const atPageEnd = () =>
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 80;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target.id, entry.intersectionRatio);
        }

        // Once the page cannot scroll any further, the last section in
        // view is the one being read — the final section is usually
        // shorter than the viewport, so by ratio it never wins and the
        // tab would stall one short of the end.
        if (atPageEnd()) {
          for (let i = sections.length - 1; i >= 0; i--) {
            if ((seen.get(sections[i].id) ?? 0) > 0) {
              setActive(sections[i].id);
              return;
            }
          }
        }

        // Otherwise the section showing the most of itself wins, which
        // keeps the tab steady instead of flickering at every boundary.
        let best = "";
        let bestRatio = 0;
        for (const [id, ratio] of seen) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        if (best) setActive(best);
      },
      {
        // Discount the pinned header, so a section counts as current
        // once it is under the bar rather than under the viewport edge.
        rootMargin: "-140px 0px -45% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const s of sections) {
      // liveElementById, not getElementById: the id matches twice while
      // the streamed shell is stranded, and observing the hidden copy
      // means no entry ever intersects and the tab never moves.
      const el = liveElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active tab in view on a phone, where the bar scrolls.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  if (sections.length < 2) return null;

  return (
    <nav
      aria-label={t.profile.sectionNav}
      className="sticky top-16 z-40 border-y border-[var(--color-line)] bg-[var(--color-ground)]/95 backdrop-blur-md"
    >
      <div className="container-app">
        <ul
          ref={listRef}
          className="m-0 flex list-none gap-1 overflow-x-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sections.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                data-id={s.id}
                aria-current={active === s.id ? "true" : undefined}
                className={cn(
                  "flex min-h-12 items-center whitespace-nowrap border-b-2 px-4 text-[0.875rem] transition-colors",
                  active === s.id
                    ? "border-[var(--color-jade)] font-bold text-[var(--color-jade)]"
                    : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
