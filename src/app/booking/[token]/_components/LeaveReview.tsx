"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface Props {
  token: string;
  businessName: string;
}

/**
 * Rate the appointment you attended.
 *
 * Only rendered for a completed booking that has not been reviewed —
 * the server decides that, and the API checks it again, so a stale page
 * cannot post a second review.
 */
export default function LeaveReview({ token, businessName }: Props) {
  const { t } = useLanguage();
  const r = t.reviews;

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError(r.leaveNeedStar);
      return;
    }

    setState("sending");
    setError(null);

    try {
      const res = await fetch(`/api/public/booking/${token}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });

      if (res.ok) {
        setState("done");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setState("idle");
      setError(res.status === 409 ? data.error ?? r.alreadyReviewed : data.error ?? r.leaveError);
    } catch {
      setState("idle");
      setError(r.leaveError);
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-ok-line)] bg-[var(--color-ok-soft)] px-5 py-6 text-center">
        <CheckCircle2
          size={28}
          strokeWidth={1.8}
          aria-hidden="true"
          className="mx-auto text-[var(--color-ok)]"
        />
        <p className="m-0 mt-3 text-[0.9375rem] font-bold text-[var(--color-ok)]">
          {r.leaveThanks}
        </p>
      </div>
    );
  }

  const shown = hover || rating;

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-5"
    >
      <h2 className="m-0 text-base font-bold text-[var(--color-ink)]">{r.leaveTitle}</h2>
      <p className="m-0 mt-1.5 text-[0.8125rem] text-[var(--color-subtle)]">{r.leaveBody}</p>

      <fieldset className="m-0 mt-4 border-0 p-0">
        <legend className="mb-2 p-0 text-[0.8125rem] font-bold text-[var(--color-muted)]">
          {r.leaveRating}
        </legend>

        {/* Radios under the stars, so the control is keyboard-operable
            and announces itself rather than being five bare buttons. */}
        <div
          className="flex gap-1"
          onMouseLeave={() => setHover(0)}
          // Stars read left-to-right as a scale in both languages.
          dir="ltr"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              onMouseEnter={() => setHover(n)}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-[var(--color-surface-2)] focus-within:ring-2 focus-within:ring-[var(--color-jade)]"
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => {
                  setRating(n);
                  setError(null);
                }}
                className="sr-only"
              />
              <span className="sr-only">{r.outOfFive.replace("{n}", String(n))}</span>
              <Star
                size={26}
                strokeWidth={1.7}
                aria-hidden="true"
                className={cn(
                  "transition-colors",
                  n <= shown
                    ? "fill-[var(--color-star)] text-[var(--color-star)]"
                    : "text-[var(--color-line-2)]",
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="review-comment" className="field-label mt-4 block">
        {r.leaveComment}
      </label>
      <textarea
        id="review-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={businessName}
        className="input resize-none"
      />

      {error && (
        <div className="mt-3">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        isLoading={state === "sending"}
        className="mt-4"
      >
        {r.leaveSubmit}
      </Button>
    </form>
  );
}
