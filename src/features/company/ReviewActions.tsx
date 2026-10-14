"use client";

import { useState } from "react";
import { Flag, Loader2, ThumbsUp } from "lucide-react";
import type { PublicReview } from "@/lib/reviews";
import { cn } from "@/lib/utils";

/**
 * The reviews block of the translations. Typed as "whatever is there,
 * read as strings" rather than the exact shape, because this component
 * needs eight of its forty keys and should not break when a ninth is
 * added elsewhere.
 */
type Labels = Record<string, unknown>;

const text = (labels: Labels, key: string): string =>
  typeof labels[key] === "string" ? (labels[key] as string) : key;

const REASONS = [
  { id: "INAPPROPRIATE", key: "reasonInappropriate" },
  { id: "FAKE", key: "reasonFake" },
  { id: "SPAM", key: "reasonSpam" },
  { id: "HARASSMENT", key: "reasonHarassment" },
  { id: "OTHER", key: "reasonOther" },
] as const;

/**
 * The two things a reader can do about a review.
 *
 * Marking one helpful is reversible — a button that cannot be unpressed
 * traps somebody who mis-tapped, and the count would drift upward only.
 *
 * Reporting opens a short form rather than firing on the first click,
 * because a one-tap report is a one-tap mistake, and a moderator reading
 * "inappropriate" with no explanation has nothing to work with.
 */
export default function ReviewActions({
  review,
  labels: r,
}: {
  review: PublicReview;
  labels: Labels;
}) {
  const [count, setCount] = useState(review.helpfulCount);
  const [voted, setVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<string>("INAPPROPRIATE");
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function vote() {
    setVoting(true);
    try {
      const url = `/api/public/reviews/${review.id}/helpful`;
      let res = await fetch(url, { method: "POST" });
      // A first-time visitor has no device cookie yet; the server
      // refuses the vote and issues one in the same answer, so trying
      // again once is all it takes. See the helpful route for why.
      if (res.status === 428) res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.data) {
        setCount(data.data.helpfulCount);
        setVoted(data.data.voted);
      }
    } catch {
      // A vote that did not land is not worth interrupting anybody over.
    } finally {
      setVoting(false);
    }
  }

  async function report(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch(`/api/public/reviews/${review.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, detail: detail.trim() || undefined }),
      });
      // The same outcome whatever the server made of it: telling
      // somebody their report was a duplicate would say more about the
      // review than they are owed.
      setSent(true);
      setReportOpen(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void vote()}
          disabled={voting}
          aria-pressed={voted}
          aria-label={text(r, "markHelpful")}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[0.75rem] transition-colors",
            voted
              ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)] font-bold text-[var(--color-jade)]"
              : "border-[var(--color-line-2)] text-[var(--color-muted)] hover:border-[var(--color-jade)]/50",
          )}
        >
          {voting ? (
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          ) : (
            <ThumbsUp size={12} aria-hidden="true" />
          )}
          {text(r, "helpful")}
          {count > 0 && <span className="num">{count}</span>}
        </button>

        {sent ? (
          <span className="text-[0.75rem] text-[var(--color-subtle)]">{text(r, "reportSent")}</span>
        ) : (
          <button
            type="button"
            onClick={() => setReportOpen((v) => !v)}
            aria-expanded={reportOpen}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[0.75rem] text-[var(--color-subtle)] hover:text-[var(--color-danger)]"
          >
            <Flag size={11} aria-hidden="true" />
            {text(r, "reportReview")}
          </button>
        )}
      </div>

      {reportOpen && !sent && (
        <form
          onSubmit={report}
          className="mt-2.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3.5"
        >
          <p className="m-0 mb-2 text-[0.75rem] font-bold text-[var(--color-ink)]">
            {text(r, "reportWhy")}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((x) => (
              <label
                key={x.id}
                className={cn(
                  "inline-flex min-h-9 cursor-pointer items-center rounded-full border px-3 text-[0.75rem] transition-colors",
                  reason === x.id
                    ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)] font-bold text-[var(--color-jade)]"
                    : "border-[var(--color-line-2)] text-[var(--color-muted)]",
                )}
              >
                <input
                  type="radio"
                  name={`reason-${review.id}`}
                  value={x.id}
                  checked={reason === x.id}
                  onChange={() => setReason(x.id)}
                  className="sr-only"
                />
                {text(r, x.key)}
              </label>
            ))}
          </div>

          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={text(r, "reportDetail")}
            aria-label={text(r, "reportDetail")}
            className="mt-2.5 w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 text-[0.8125rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-jade)]"
          />

          <div className="mt-2.5 flex gap-2">
            <button type="submit" disabled={sending} className="btn btn-primary btn-sm">
              {sending ? <Loader2 size={13} className="animate-spin" /> : null}
              {text(r, "reportSend")}
            </button>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="btn btn-ghost btn-sm"
            >
              {text(r, "reportCancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
