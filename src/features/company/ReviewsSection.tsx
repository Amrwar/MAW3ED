"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, MessageSquare, Star, Store } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import Alert from "@/components/ui/Alert";
import { REVIEW_SORTS, type ReviewSort } from "@/lib/review-sorts";
import type { PublicReview, RatingSummary } from "@/lib/reviews";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import ReviewActions from "./ReviewActions";

interface Props {
  businessSlug: string;
  summary: RatingSummary;
  initialReviews: PublicReview[];
  /** How many match the unfiltered set — equals summary.count on first load. */
  initialMatched: number;
}

const STARS = [5, 4, 3, 2, 1] as const;

/**
 * The reviews block.
 *
 * One rule runs through it: the page shows a summary, or it shows the
 * empty state, never both. `summary.count` is the only thing that
 * decides which — the same number the bars are built from and the same
 * one the header shows, because they all come out of one query in
 * lib/reviews.ts.
 *
 * A filter that matches nothing is a third state again: the summary
 * stays (there are reviews), and the list says this filter has none.
 */
export default function ReviewsSection({
  businessSlug,
  summary,
  initialReviews,
  initialMatched,
}: Props) {
  const { t, lang } = useLanguage();
  const r = t.reviews;

  const [reviews, setReviews] = useState(initialReviews);
  const [matched, setMatched] = useState(initialMatched);
  const [sort, setSort] = useState<ReviewSort>("recent");
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const hasReviews = summary.count > 0;

  async function refetch(nextSort: ReviewSort, nextStar: number | null) {
    setFailed(false);
    const params = new URLSearchParams({ sort: nextSort });
    if (nextStar) params.set("rating", String(nextStar));

    try {
      const res = await fetch(`/api/public/${businessSlug}/reviews?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { reviews?: PublicReview[]; matched?: number };
      startTransition(() => {
        setReviews(data.reviews ?? []);
        setMatched(data.matched ?? 0);
      });
    } catch {
      setFailed(true);
    }
  }

  function changeSort(next: ReviewSort) {
    setSort(next);
    void refetch(next, starFilter);
  }

  function toggleStar(star: number) {
    const next = starFilter === star ? null : star;
    setStarFilter(next);
    void refetch(sort, next);
  }

  /* ── Nothing to show ──────────────────────────────────── */
  if (!hasReviews) {
    return (
      <section id="reviews" className="scroll-mt-32">
        <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">{r.title}</h2>
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)]">
          <EmptyState
            icon={<MessageSquare size={24} strokeWidth={1.7} />}
            title={r.emptyTitle}
            body={r.emptyBody}
          />
        </div>
      </section>
    );
  }

  /* ── Summary + list ───────────────────────────────────── */
  return (
    <section id="reviews" className="scroll-mt-32">
      <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">{r.title}</h2>

      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">

        {/* Headline and the distribution it is made of */}
        <div className="flex flex-col gap-7 sm:flex-row sm:items-center">
          <div className="shrink-0 text-center sm:w-36">
            <p className="num m-0 text-[3rem] font-light leading-none text-[var(--color-ink)]">
              {summary.average?.toFixed(1)}
            </p>
            <div
              className="mt-2.5 flex justify-center gap-0.5"
              role="img"
              aria-label={r.outOfFive.replace("{n}", String(summary.average))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={15}
                  aria-hidden="true"
                  className={
                    n <= Math.round(summary.average ?? 0)
                      ? "fill-[var(--color-star)] text-[var(--color-star)]"
                      : "fill-[var(--color-line)] text-[var(--color-line)]"
                  }
                />
              ))}
            </div>
            <p className="m-0 mt-2 text-[0.78125rem] text-[var(--color-subtle)]">
              <span className="num">{num(summary.count, lang)}</span> {r.reviewWord}
            </p>
          </div>

          {/* Each bar is also the filter for that bucket. */}
          <ul className="m-0 min-w-0 flex-1 list-none space-y-1 p-0">
            {STARS.map((star) => {
              const n = summary.distribution[star];
              const pct = summary.count > 0 ? (n / summary.count) * 100 : 0;
              const active = starFilter === star;

              return (
                <li key={star}>
                  <button
                    type="button"
                    onClick={() => toggleStar(star)}
                    aria-pressed={active}
                    disabled={n === 0}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-sm)] px-2 transition-colors",
                      n === 0
                        ? "cursor-default opacity-50"
                        : active
                          ? "bg-[var(--color-jade-soft)]"
                          : "hover:bg-[var(--color-surface-2)]",
                    )}
                  >
                    <span className="num flex w-12 shrink-0 items-center justify-end gap-1 text-[0.8125rem] text-[var(--color-muted)]">
                      {num(star, lang)}
                      <Star
                        size={12}
                        aria-hidden="true"
                        className="fill-[var(--color-star)] text-[var(--color-star)]"
                      />
                    </span>

                    <span
                      aria-hidden="true"
                      className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]"
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--color-star)] transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </span>

                    <span className="num w-10 shrink-0 text-start text-[0.8125rem] text-[var(--color-subtle)]">
                      {num(n, lang)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── Controls ── */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-5">
          <p className="m-0 text-[0.8125rem] text-[var(--color-muted)]" aria-live="polite">
            {starFilter
              ? r.showingFiltered
                  .replace("{n}", num(matched, lang))
                  .replace("{s}", num(starFilter, lang))
              : r.showingAll.replace("{n}", num(matched, lang))}
          </p>

          {starFilter && (
            <button
              type="button"
              onClick={() => toggleStar(starFilter)}
              className="min-h-11 text-[0.8125rem] font-bold text-[var(--color-jade)] underline-offset-4 hover:underline"
            >
              {r.clearFilter}
            </button>
          )}

          <label className="ms-auto flex min-h-11 items-center gap-2 text-[0.8125rem] text-[var(--color-subtle)]">
            {r.sortLabel}
            <select
              value={sort}
              onChange={(e) => changeSort(e.target.value as ReviewSort)}
              className="select h-11 w-auto min-w-[9rem]"
            >
              {REVIEW_SORTS.map((s) => (
                <option key={s} value={s}>
                  {r.sorts[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {failed && (
          <div className="mt-4">
            <Alert tone="danger">{r.loadError}</Alert>
          </div>
        )}

        {/* ── The reviews ── */}
        <ul
          className={cn(
            "m-0 mt-5 list-none space-y-5 p-0 transition-opacity",
            pending && "opacity-60",
          )}
        >
          {reviews.length === 0 && !failed ? (
            <li className="py-8 text-center text-[0.875rem] text-[var(--color-subtle)]">
              {r.noneForFilter}
            </li>
          ) : (
            reviews.map((rev) => <ReviewItem key={rev.id} review={rev} />)
          )}
        </ul>
      </div>
    </section>
  );
}

function ReviewItem({ review }: { review: PublicReview }) {
  const { t, lang } = useLanguage();
  const r = t.reviews;

  const when = new Date(review.createdAt).toLocaleDateString(
    lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <li className="border-t border-[var(--color-line)] pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[0.875rem] font-bold text-[var(--color-ink)]">
          {review.authorName}
        </span>

        {/* Only where the appointment was actually completed. */}
        {review.verifiedBooking && (
          <span className="badge badge-accent gap-1">
            <BadgeCheck size={11} strokeWidth={2.2} aria-hidden="true" />
            {r.verifiedBooking}
          </span>
        )}

        {/* Said plainly, because people vote on what they read and the
            words may have changed since. */}
        {review.editedAt && (
          <span className="text-[0.6875rem] text-[var(--color-subtle)]">{r.edited}</span>
        )}

        <span className="num ms-auto text-[0.75rem] text-[var(--color-subtle)]">{when}</span>
      </div>

      <div
        className="mt-2 flex gap-0.5"
        role="img"
        aria-label={r.outOfFive.replace("{n}", String(review.rating))}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={13}
            aria-hidden="true"
            className={
              n <= review.rating
                ? "fill-[var(--color-star)] text-[var(--color-star)]"
                : "fill-[var(--color-line)] text-[var(--color-line)]"
            }
          />
        ))}
      </div>

      {review.serviceName && (
        <p className="m-0 mt-2 text-[0.75rem] text-[var(--color-subtle)]">
          {r.forService} {review.serviceName}
        </p>
      )}

      {review.comment && (
        <p className="m-0 mt-2.5 whitespace-pre-line text-[0.90625rem] leading-[1.8] text-[var(--color-ink-2)]">
          {review.comment}
        </p>
      )}

      {review.photos.length > 0 && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
          {review.photos.map((src) => (
            <li key={src}>
              <a href={src} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={r.reviewPhoto}
                  loading="lazy"
                  className="h-24 w-24 rounded-[var(--radius-md)] object-cover transition-opacity hover:opacity-85"
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      <ReviewActions review={review} labels={r} />

      {/* The owner's reply sits under the review, indented, and is
          labelled — never presented as another review. */}
      {review.response && (
        <div className="mt-3.5 rounded-[var(--radius-md)] border-s-[3px] border-[var(--color-jade)] bg-[var(--color-surface-2)] px-4 py-3 ps-4">
          <p className="m-0 flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--color-ok)]">
            <Store size={12} strokeWidth={2} aria-hidden="true" />
            {r.ownerReply}
          </p>
          <p className="m-0 mt-1.5 whitespace-pre-line text-[0.84375rem] leading-[1.75] text-[var(--color-muted)]">
            {review.response.text}
          </p>
        </div>
      )}
    </li>
  );
}
