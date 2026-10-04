"use client";

import { Star, MessageSquare } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { num, rating as fmtRating } from "@/lib/fmt";

interface Props {
  rating: number;
  reviewCount: number;
}

/**
 * Shows the business's real rating only. The previous build rendered
 * three invented reviews with invented customer names on every
 * business page; there is no Review model in the schema, so there is
 * nothing real to list until one exists.
 */
export default function ReviewsSection({ rating, reviewCount }: Props) {
  const { lang } = useLanguage();
  const hasReviews = reviewCount > 0;

  return (
    <section id="reviews">
      <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">التقييمات</h2>

      {hasReviews ? (
        <div className="flex flex-wrap items-center gap-8 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] px-7 py-6">
          <div className="shrink-0 text-center">
            <div className="num text-[3rem] font-light leading-none text-[var(--color-ink)]">
              {fmtRating(rating)}
            </div>
            <div className="mt-2.5 flex justify-center gap-0.5" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={14}
                  className={
                    n <= Math.round(rating)
                      ? "fill-[var(--color-star)] text-[var(--color-star)]"
                      : "fill-[var(--color-line)] text-[var(--color-line)]"
                  }
                />
              ))}
            </div>
            <div className="mt-2 text-[0.78125rem] text-[var(--color-subtle)]">
              <span className="num">{num(reviewCount, lang)}</span> تقييم
            </div>
          </div>

          <p className="m-0 min-w-0 flex-1 text-[0.90625rem] leading-[1.85] text-[var(--color-muted)]">
            التقييم محسوب من تقييمات العملاء بعد كل موعد مكتمل.
          </p>
        </div>
      ) : (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)]">
          <EmptyState
            icon={<MessageSquare size={24} strokeWidth={1.7} />}
            title="لسه مفيش تقييمات"
            body="أول تقييم هيظهر هنا بعد ما العميل يكمّل موعده."
          />
        </div>
      )}
    </section>
  );
}
