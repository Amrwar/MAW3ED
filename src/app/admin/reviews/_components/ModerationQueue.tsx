"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Eye, EyeOff, Flag, Loader2, Star } from "lucide-react";
import Alert from "@/components/ui/Alert";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

type Action = "approve" | "hide" | "investigate" | "restore" | "flag";

export interface QueueReview {
  id: string;
  rating: number;
  comment: string | null;
  photos: string[];
  status: string;
  helpfulCount: number;
  edited: boolean;
  createdAt: string;
  moderationNote: string | null;
  moderatedAt: string | null;
  businessName: string;
  businessSlug: string;
  booking: {
    reference: string | null;
    status: string;
    date: string;
    customerName: string;
    serviceName: string | null;
  };
  reports: {
    id: string;
    reason: string;
    detail: string | null;
    status: string;
    byBusiness: boolean;
    createdAt: string;
  }[];
}

const REASON_AR: Record<string, string> = {
  INAPPROPRIATE: "محتوى غير لائق",
  FAKE: "تقييم مزيّف",
  SPAM: "سبام",
  HARASSMENT: "تنمّر أو إساءة",
  OTHER: "سبب آخر",
};

const STATUS_AR: Record<string, string> = {
  PUBLISHED: "ظاهر",
  UNDER_REVIEW: "تحت المراجعة",
  HIDDEN: "مخفي",
  REMOVED: "سحبه صاحبه",
};

/**
 * What a moderator sees.
 *
 * The booking is shown beside the review because it is usually what
 * settles the question: a review of an appointment that was completed,
 * by somebody whose name matches, is a different thing from a five-star
 * review attached to a booking that was cancelled an hour after it was
 * made.
 */
export default function ModerationQueue({
  reviews,
  tally,
  view,
}: {
  reviews: QueueReview[];
  tally: Record<string, number>;
  view: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function act(id: string, action: Action) {
    setBusy(id + action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[id] }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "تعذّر تنفيذ الإجراء");
        return;
      }
      router.refresh();
    } catch {
      setError("تعذّر الاتصال");
    } finally {
      setBusy(null);
    }
  }

  const tabs = [
    { id: "queue", label: "في الانتظار", n: tally.UNDER_REVIEW ?? 0 },
    { id: "hidden", label: "مخفية", n: tally.HIDDEN ?? 0 },
    { id: "all", label: "الكل", n: Object.values(tally).reduce((a, b) => a + b, 0) },
  ];

  const date = (iso: string) =>
    new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));

  return (
    <div>
      <div className="max-w-[56rem]">
        <header className="mb-6">
          <h1 className="m-0 text-[1.5rem] font-light tracking-tight text-[var(--color-ink)]">
            مراجعة التقييمات
          </h1>
          <p className="m-0 mt-1 text-[0.8125rem] text-[var(--color-subtle)]">
            البلاغ لوحده مش بيخفي حاجة — التقييم بيفضل ظاهر لحد ما حد يقرره.
          </p>
        </header>

        <nav className="mb-5 flex gap-1">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/admin/reviews?view=${t.id}`}
              aria-current={view === t.id ? "page" : undefined}
              className={cn(
                "min-h-11 rounded-full px-4 text-[0.8125rem] leading-[2.75rem] transition-colors",
                view === t.id
                  ? "bg-[var(--color-jade)] font-bold text-white"
                  : "bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
              )}
            >
              {t.label}
              <span className="num ms-1.5 opacity-70">{t.n}</span>
            </Link>
          ))}
        </nav>

        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Check size={24} strokeWidth={1.7} />}
              title="مفيش حاجة مستنية"
              body="أول ما حد يبلّغ عن تقييم، هيظهر هنا بكل تفاصيله."
            />
          </div>
        ) : (
          <ul className="m-0 list-none space-y-4 p-0">
            {reviews.map((r) => (
              <li key={r.id} className="card p-5">
                {/* ── The review ─────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex gap-0.5" aria-label={`${r.rating} من 5`}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            size={13}
                            aria-hidden="true"
                            fill="currentColor"
                            className={
                              i <= r.rating
                                ? "text-[var(--color-star)]"
                                : "text-[var(--color-line-2)]"
                            }
                          />
                        ))}
                      </span>
                      <span className="rounded-full bg-[var(--color-surface-3)] px-2 py-0.5 text-[0.6875rem] font-bold text-[var(--color-muted)]">
                        {STATUS_AR[r.status] ?? r.status}
                      </span>
                      {r.edited && (
                        <span className="text-[0.6875rem] text-[var(--color-faint)]">معدّل</span>
                      )}
                    </div>
                    <Link
                      href={`/company/${r.businessSlug}`}
                      className="mt-1 block text-[0.9375rem] font-bold text-[var(--color-ink)] hover:text-[var(--color-jade)]"
                    >
                      {r.businessName}
                    </Link>
                  </div>
                  <span className="num shrink-0 text-[0.6875rem] text-[var(--color-faint)]">
                    {date(r.createdAt)}
                  </span>
                </div>

                {r.comment && (
                  <p className="m-0 mt-3 whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3 text-[0.875rem] leading-relaxed text-[var(--color-ink-2)]">
                    {r.comment}
                  </p>
                )}

                {r.photos.length > 0 && (
                  <ul className="m-0 mt-2 flex list-none gap-2 p-0">
                    {r.photos.map((src) => (
                      <li key={src}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt="صورة مرفقة بالتقييم"
                          className="h-20 w-20 rounded-[var(--radius-sm)] object-cover"
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {/* ── The booking behind it ──────────────── */}
                <dl className="m-0 mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--color-line)] pt-3 text-[0.75rem]">
                  <Fact label="الحجز" value={r.booking.reference ?? "—"} />
                  <Fact label="حالته" value={r.booking.status} />
                  <Fact label="يومه" value={r.booking.date} />
                  <Fact label="العميل" value={r.booking.customerName} />
                  {r.booking.serviceName && (
                    <Fact label="الخدمة" value={r.booking.serviceName} />
                  )}
                  <Fact label="مفيد" value={String(r.helpfulCount)} />
                </dl>

                {/* ── Who complained ─────────────────────── */}
                {r.reports.length > 0 && (
                  <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
                    {r.reports.map((rep) => (
                      <li
                        key={rep.id}
                        className="rounded-[var(--radius-sm)] border-s-2 border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2"
                      >
                        <p className="m-0 flex flex-wrap items-center gap-2 text-[0.75rem] font-bold text-[var(--color-danger)]">
                          <AlertTriangle size={12} aria-hidden="true" />
                          {REASON_AR[rep.reason] ?? rep.reason}
                          {rep.byBusiness && (
                            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[0.625rem]">
                              من صاحب المكان
                            </span>
                          )}
                          <span className="num ms-auto font-normal text-[var(--color-muted)]">
                            {date(rep.createdAt)}
                          </span>
                        </p>
                        {rep.detail && (
                          <p className="m-0 mt-1 text-[0.75rem] text-[var(--color-ink-2)]">
                            {rep.detail}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {r.moderationNote && (
                  <p className="m-0 mt-3 text-[0.75rem] text-[var(--color-subtle)]">
                    ملاحظة سابقة: {r.moderationNote}
                  </p>
                )}

                {/* ── What to do ─────────────────────────── */}
                <div className="mt-4 border-t border-[var(--color-line)] pt-3">
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    placeholder="ملاحظة للمراجع اللي بعدك (اختياري)"
                    aria-label="ملاحظة المراجعة"
                    maxLength={1000}
                    className="mb-2.5 min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-jade)]"
                  />

                  <div className="flex flex-wrap gap-2">
                    {r.status === "UNDER_REVIEW" && (
                      <Act
                        onClick={() => act(r.id, "approve")}
                        busy={busy === r.id + "approve"}
                        icon={Check}
                        tone="ok"
                      >
                        اعتماد
                      </Act>
                    )}
                    {r.status !== "HIDDEN" && (
                      <Act
                        onClick={() => act(r.id, "hide")}
                        busy={busy === r.id + "hide"}
                        icon={EyeOff}
                        tone="danger"
                      >
                        إخفاء
                      </Act>
                    )}
                    {r.status === "HIDDEN" && (
                      <Act
                        onClick={() => act(r.id, "restore")}
                        busy={busy === r.id + "restore"}
                        icon={Eye}
                        tone="ok"
                      >
                        إرجاع
                      </Act>
                    )}
                    {r.status === "PUBLISHED" && (
                      <>
                        <Act
                          onClick={() => act(r.id, "investigate")}
                          busy={busy === r.id + "investigate"}
                          icon={AlertTriangle}
                        >
                          فحص
                        </Act>
                        <Act
                          onClick={() => act(r.id, "flag")}
                          busy={busy === r.id + "flag"}
                          icon={Flag}
                        >
                          تعليم
                        </Act>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="m-0 text-[0.625rem] text-[var(--color-faint)]">{label}</dt>
      <dd className="m-0 font-bold text-[var(--color-ink-2)]">{value}</dd>
    </div>
  );
}

function Act({
  onClick,
  busy,
  icon: Icon,
  tone,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  icon: typeof Check;
  tone?: "ok" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[0.8125rem] font-bold transition-colors disabled:opacity-60",
        tone === "ok"
          ? "border-[var(--color-jade)] text-[var(--color-jade)] hover:bg-[var(--color-jade-tint)]"
          : tone === "danger"
            ? "border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
            : "border-[var(--color-line-2)] text-[var(--color-muted)] hover:border-[var(--color-ink)]",
      )}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
      ) : (
        <Icon size={14} aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
