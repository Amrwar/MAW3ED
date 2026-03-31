import type { Business } from "@/types/business";

interface AboutSectionProps {
  business: Business;
}

export default function AboutSection({ business }: AboutSectionProps) {
  if (!business.about) return null;

  return (
    <div className="py-8 border-b border-[var(--color-border)]">
      <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-4">
        عن {business.nameAr}
      </h2>
      <p className="text-[var(--color-text-secondary)] leading-relaxed text-sm">
        {business.about || business.taglineAr}
      </p>

      {/* Tags */}
      {business.tags && business.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5">
          {business.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 text-xs font-medium bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded-full border border-[var(--color-border)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
