import { ImagePlus } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

interface Props {
  /** Uploaded gallery images. The schema has no gallery field yet, so
   *  this arrives empty until one exists — hence the empty state. */
  images?: string[];
}

export default function GallerySection({ images = [] }: Props) {
  return (
    <section id="gallery">
      <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">الصور</h2>

      {images.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-line-2)] bg-[var(--color-surface)]">
          <EmptyState
            icon={<ImagePlus size={24} strokeWidth={1.7} />}
            title="لسه مفيش صور"
            body="الصور بتزوّد الحجوزات بشكل ملحوظ. لو ده نشاطك، ارفع صور من الإعدادات."
          />
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((src, i) => (
            <li
              key={src}
              className={i === 0 ? "col-span-2 row-span-2 min-w-0" : "min-w-0"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="h-full w-full rounded-[var(--radius-lg)] object-cover"
                style={{ aspectRatio: i === 0 ? "1 / 1" : "4 / 3" }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
