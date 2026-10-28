"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { useMounted } from "@/hooks/useMounted";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { cdnImage } from "@/lib/cdn-image";

export interface GalleryImage {
  id: string;
  url: string;
  /** Doubles as the grouping label when the owner has written one. */
  caption: string | null;
}

interface Props {
  images: GalleryImage[];
  businessName: string;
}

/**
 * The photos.
 *
 * Groups by caption only when the captions actually divide the set —
 * a tab bar where every photo lands in "other", or where one group
 * holds everything, is noise.
 */
export default function GallerySection({ images, businessName }: Props) {
  const { t } = useLanguage();
  const g = t.gallery;
  const [open, setOpen] = useState<number | null>(null);

  const groups = [...new Set(images.map((i) => i.caption?.trim()).filter(Boolean))] as string[];
  const useGroups = groups.length > 1 && images.every((i) => i.caption?.trim());
  const [group, setGroup] = useState<string>("all");

  const shown = useGroups && group !== "all" ? images.filter((i) => i.caption?.trim() === group) : images;

  if (images.length === 0) {
    return (
      <section id="gallery" className="scroll-mt-32">
        <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">{g.title}</h2>
        <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-line-2)] bg-[var(--color-surface)]">
          <EmptyState
            icon={<ImagePlus size={24} strokeWidth={1.7} />}
            title={g.emptyTitle}
            body={g.emptyBody}
          />
        </div>
      </section>
    );
  }

  return (
    <section id="gallery" className="scroll-mt-32">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="m-0 text-[1.5rem] font-bold text-[var(--color-ink)]">{g.title}</h2>
        <span className="num text-[0.8125rem] text-[var(--color-subtle)]">{images.length}</span>
      </div>

      {useGroups && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGroup("all")}
            aria-pressed={group === "all"}
            className={cn("chip", group === "all" && "chip-active")}
          >
            {g.all}
          </button>
          {groups.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setGroup(c)}
              aria-pressed={group === c}
              className={cn("chip", group === c && "chip-active")}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* The first photo takes a bigger tile, which gives the grid a
          focal point instead of a uniform wall of thumbnails. */}
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
        {shown.map((img, i) => (
          <li key={img.id} className={cn("min-w-0", i === 0 && "col-span-2 row-span-2")}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="block h-full w-full overflow-hidden rounded-[var(--radius-lg)]"
              aria-label={img.caption ?? g.openImage.replace("{n}", String(i + 1))}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cdnImage(img.url, 800)}
                alt={img.caption ?? ""}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.03]"
                style={{ aspectRatio: i === 0 ? "1 / 1" : "4 / 3" }}
              />
            </button>
          </li>
        ))}
      </ul>

      {open !== null && (
        <Lightbox
          images={shown}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          businessName={businessName}
        />
      )}
    </section>
  );
}

/**
 * Full-screen viewer.
 *
 * Arrow keys step through, Escape closes, and the arrows swap under
 * RTL so "next" always points the way the page reads.
 */
function Lightbox({
  images,
  index,
  onIndex,
  onClose,
  businessName,
}: {
  images: GalleryImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  businessName: string;
}) {
  const mounted = useMounted();
  const { t, lang } = useLanguage();
  const g = t.gallery;
  const isAr = lang === "ar";

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return onClose();
      // In RTL the left arrow moves forward through the strip.
      const forward = isAr ? "ArrowLeft" : "ArrowRight";
      const back = isAr ? "ArrowRight" : "ArrowLeft";
      if (e.key === forward) onIndex((index + 1) % images.length);
      if (e.key === back) onIndex((index - 1 + images.length) % images.length);
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, images.length, isAr, onClose, onIndex]);

  if (!mounted) return null;

  const current = images[index];
  const PrevIcon = isAr ? ChevronRight : ChevronLeft;
  const NextIcon = isAr ? ChevronLeft : ChevronRight;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={g.viewerLabel.replace("{name}", businessName)}
      className="fixed inset-0 z-[120] flex flex-col bg-[rgb(17_32_28/0.94)]"
    >
      <div className="flex shrink-0 items-center justify-between px-5 py-4">
        <p className="num m-0 text-[0.875rem] text-[var(--color-inverse)]/80">
          {index + 1} / {images.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={g.close}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-inverse)]/10 text-[var(--color-inverse)] transition-colors hover:bg-[var(--color-inverse)]/20"
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-3 pb-3">
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onIndex((index - 1 + images.length) % images.length)}
            aria-label={g.previous}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-inverse)]/10 text-[var(--color-inverse)] transition-colors hover:bg-[var(--color-inverse)]/20"
          >
            <PrevIcon size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        <figure className="m-0 flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cdnImage(current.url, 1600)}
            alt={current.caption ?? ""}
            className="max-h-full min-h-0 max-w-full rounded-[var(--radius-lg)] object-contain"
          />
          {current.caption && (
            <figcaption className="m-0 text-center text-[0.875rem] text-[var(--color-inverse)]/80">
              {current.caption}
            </figcaption>
          )}
        </figure>

        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onIndex((index + 1) % images.length)}
            aria-label={g.next}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-inverse)]/10 text-[var(--color-inverse)] transition-colors hover:bg-[var(--color-inverse)]/20"
          >
            <NextIcon size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
