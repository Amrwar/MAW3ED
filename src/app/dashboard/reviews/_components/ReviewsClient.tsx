"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Star, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { arCount, enCount, num } from "@/lib/fmt";
import type { PublicReview, RatingSummary } from "@/lib/reviews";

const REVIEW = { one: "تقييم واحد", two: "تقييمين", few: "تقييمات", many: "تقييم" };

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
            {ar ? arCount(summary.count, REVIEW) : enCount(summary.count, "review")}
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
              <span className="num ms-auto text-[0.6875rem] text-[var(--color-subtle)]">
                {date(r.createdAt)}
              </span>
            </div>

            {r.comment && (
              <p className="m-0 mt-2 text-[0.8125rem] leading-relaxed text-[var(--color-ink-2)]">
                {r.comment}
              </p>
            )}

            <Reply review={r} ar={ar} />
          </li>
        ))}
      </ul>

      {total > reviews.length && (
        <p className="num m-0 text-center text-[0.75rem] text-[var(--color-subtle)]">
          {ar
            ? `بتعرض أحدث ${num(reviews.length, lang)} من ${num(total, lang)}`
            : `Showing the latest ${num(reviews.length, lang)} of ${num(total, lang)}`}
        </p>
      )}
    </div>
  );
}

/**
 * The owner's public answer.
 *
 * A reply is the only remedy a review platform can honestly offer a
 * business that disagrees: it never changes the rating and never hides
 * anything. If they believe a review breaks the rules there is a report
 * button on the public page, and a moderator decides — not them.
 */
function Reply({ review, ar }: { review: PublicReview; ar: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.response?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PUT" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/reviews/${review.id}/response`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PUT" ? JSON.stringify({ response: text.trim() }) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? (ar ? "تعذّر الحفظ" : "Could not save"));
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError(ar ? "تعذّر الاتصال" : "Could not connect");
    } finally {
      setBusy(false);
    }
  }

  if (review.response && !open) {
    return (
      <div className="mt-3 rounded-[var(--radius-md)] border-s-2 border-[var(--color-jade)] bg-[var(--color-surface-2)] p-3">
        <p className="m-0 text-[0.6875rem] font-bold text-[var(--color-jade)]">
          {ar ? "ردّك" : "Your reply"}
        </p>
        <p className="m-0 mt-1 whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[var(--color-ink-2)]">
          {review.response.text}
        </p>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-9 text-[0.75rem] font-bold text-[var(--color-jade)]"
          >
            {ar ? "تعديل" : "Edit"}
          </button>
          <button
            type="button"
            onClick={() => void send("DELETE")}
            disabled={busy}
            className="inline-flex min-h-9 items-center gap-1 text-[0.75rem] text-[var(--color-danger)]"
          >
            <Trash2 size={11} aria-hidden="true" />
            {ar ? "حذف الرد" : "Remove"}
          </button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-[0.75rem] font-bold text-[var(--color-jade)]"
      >
        <MessageSquare size={12} aria-hidden="true" />
        {ar ? "ردّ على التقييم" : "Reply"}
      </button>
    );
  }

  return (
    <div className="mt-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={1000}
        autoFocus
        placeholder={
          ar
            ? "ردّك هيظهر تحت التقييم للناس كلها"
            : "Your reply appears under the review, for everyone"
        }
        aria-label={ar ? "ردّك" : "Your reply"}
        className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[0.8125rem] leading-relaxed text-[var(--color-ink)] outline-none focus:border-[var(--color-jade)]"
      />
      {error && <p className="m-0 mt-1 text-[0.75rem] text-[var(--color-danger)]">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => void send("PUT")}
          disabled={busy || !text.trim()}
          className="btn btn-primary btn-sm"
        >
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
          {ar ? "انشر الرد" : "Publish reply"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
          {ar ? "إلغاء" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
