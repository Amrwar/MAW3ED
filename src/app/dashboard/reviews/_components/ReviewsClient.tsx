"use client";

import { Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import type { PublicReview, RatingSummary } from "@/lib/reviews";

/**
 * The business's own view of its reviews.
 *
 * The same rating calculation the public page uses, from the same
 * function — a business seeing a different average to its customers
 * would be worse than showing none.
 */
export default function ReviewsClient({
  summary,
  reviews,
  total,
}: {
  summary: RatingSummary;
  reviews: PublicReview[];
  total: number;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const max = Math.max(1, ...Object.values(summary.distribution));

  const date = (iso: string) =>
    new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">
          {ar ? "التقييمات" : "Reviews"}
        </h1>
      </header>

      <section className="card grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center">
          <p className="num m-0 text-[2.5rem] font-bold leading-none text-[var(--color-ink)]">
            {summary.average !== null ? num(summary.average, lang) : "—"}
          </p>
          <div className="mt-1.5 flex justify-center gap-0.5" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={14}
                className={
                  summary.average !== null && i <= Math.round(summary.average)
                    ? "text-[var(--color-star)]"
                    : "text-[var(--color-line-2)]"
                }
                fill="currentColor"
              />
            ))}
          </div>
          <p className="num m-0 mt-1.5 text-[0.75rem] text-[var(--color-subtle)]">
            {ar ? `${num(summary.count, lang)} تقييم` : `${num(summary.count, lang)} reviews`}
          </p>
        </div>

        <ul className="m-0 list-none space-y-1.5 p-0">
          {([5, 4, 3, 2, 1] as const).map((stars) => {
            const n = summary.distribution[stars];
            return (
              <li key={stars} className="flex items-center gap-3">
                <span className="num w-3 shrink-0 text-[0.75rem] text-[var(--color-subtle)]">
                  {num(stars, lang)}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                  <span
                    className="block h-full rounded-full bg-[var(--color-star)]"
                    style={{ width: `${(n / max) * 100}%` }}
                  />
                </span>
                <span className="num w-7 shrink-0 text-end text-[0.75rem] text-[var(--color-subtle)]">
                  {num(n, lang)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <ul className="m-0 list-none space-y-2 p-0">
        {reviews.map((r) => (
          <li key={r.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex gap-0.5" aria-label={`${r.rating} / 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={12}
                    aria-hidden="true"
                    className={
                      i <= r.rating ? "text-[var(--color-star)]" : "text-[var(--color-line-2)]"
                    }
                    fill="currentColor"
                  />
                ))}
              </span>
              <span className="text-[0.875rem] font-bold text-[var(--color-ink)]">
                {r.authorName}
              </span>
              {r.verifiedBooking && (
                <span className="rounded-full bg-[var(--color-jade-tint)] px-2 py-0.5 text-[0.6875rem] font-bold text-[var(--color-jade)]">
                  {ar ? "زيارة مؤكدة" : "Verified visit"}
                </span>
              )}
              <span className="num ms-auto text-[0.6875rem] text-[var(--color-faint)]">
                {date(r.createdAt)}
              </span>
            </div>

            {r.comment && (
              <p className="m-0 mt-2 text-[0.8125rem] leading-relaxed text-[var(--color-ink-2)]">
                {r.comment}
              </p>
            )}

            {r.response && (
              <div className="mt-3 rounded-[var(--radius-md)] border-s-2 border-[var(--color-jade)] bg-[var(--color-surface-2)] p-3">
                <p className="m-0 text-[0.6875rem] font-bold text-[var(--color-jade)]">
                  {ar ? "ردّك" : "Your reply"}
                </p>
                <p className="m-0 mt-1 text-[0.8125rem] leading-relaxed text-[var(--color-ink-2)]">
                  {r.response.text}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>

      {total > reviews.length && (
        <p className="num m-0 text-center text-[0.75rem] text-[var(--color-faint)]">
          {ar
            ? `بتعرض أحدث ${num(reviews.length, lang)} من ${num(total, lang)}`
            : `Showing the latest ${num(reviews.length, lang)} of ${num(total, lang)}`}
        </p>
      )}
    </div>
  );
}
