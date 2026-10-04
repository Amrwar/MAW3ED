import type { Business } from "@/types/business";

export default function AboutSection({ business }: { business: Business }) {
  const text = business.about || business.taglineAr;
  if (!text) return null;

  return (
    <section id="about">
      <h2 className="mb-4 text-[1.5rem] font-bold text-[var(--color-ink)]">
        عن {business.nameAr}
      </h2>

      <p className="m-0 max-w-[62ch] text-[0.96875rem] leading-[1.95] text-[var(--color-muted)]">
        {text}
      </p>

      {business.tags && business.tags.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2.5">
          {business.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 text-[0.8125rem] text-[var(--color-ink-2)]"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
