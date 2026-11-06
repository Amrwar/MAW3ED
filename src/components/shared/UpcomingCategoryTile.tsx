import { coverClassFor } from "@/lib/category-cover";

/**
 * A category nobody has listed in yet. Greyed, and it links nowhere:
 * /categories/[slug] does not exist until a business is published in it.
 */
export default function UpcomingCategoryTile({
  slug,
  nameAr,
  nameEn,
  isAr,
}: {
  slug: string;
  nameAr: string;
  nameEn: string;
  isAr: boolean;
}) {
  const name = isAr ? nameAr : nameEn || nameAr;
  return (
    <div className="card block overflow-hidden opacity-75">
      <span aria-hidden="true" className={`block h-[8.5rem] grayscale ${coverClassFor(slug)}`} />
      <span className="block px-5 pb-5 pt-4">
        <span className="block truncate text-base font-bold text-[var(--color-muted)]">{name}</span>
        <span className="mt-1 block text-[0.78125rem] text-[var(--color-subtle)]">
          {isAr ? "قريبًا على موعد" : "Coming soon"}
        </span>
      </span>
    </div>
  );
}
