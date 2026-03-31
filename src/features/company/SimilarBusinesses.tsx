import { businesses } from "@/data/businesses";
import BusinessCard from "@/components/shared/BusinessCard";

interface SimilarBusinessesProps {
  currentSlug: string;
  categorySlug: string;
}

export default function SimilarBusinesses({
  currentSlug,
  categorySlug,
}: SimilarBusinessesProps) {
  const similar = businesses
    .filter(
      (b) => b.categorySlug === categorySlug && b.slug !== currentSlug
    )
    .slice(0, 3);

  if (similar.length === 0) return null;

  return (
    <div className="py-8">
      <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-6">
        أعمال مشابهة
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {similar.map((b) => (
          <BusinessCard key={b.id} business={b} variant="compact" />
        ))}
      </div>
    </div>
  );
}
