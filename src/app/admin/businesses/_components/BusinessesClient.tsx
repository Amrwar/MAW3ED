"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2, Search, Star } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { Pill, when } from "../../_components/AdminBits";
import { ACTION_LABELS, STATUS_LABELS, canApply, type BusinessAction } from "@/lib/admin/business-actions";
import type { BusinessStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

export interface AdminBusinessRow {
  id: string;
  slug: string;
  name: string;
  status: BusinessStatus;
  statusNote: string | null;
  isVerified: boolean;
  isFeatured: boolean;
  isPublished: boolean;
  plan: string;
  city: string;
  category: string;
  ownerEmail: string | null;
  ownerName: string | null;
  bookings: number;
  services: number;
  createdAt: string;
  statusChangedAt: string | null;
}

/**
 * The moderation list.
 *
 * Buttons are hidden when the role cannot use them, but that is a
 * courtesy — the route checks the permission itself and answers 404.
 * Hiding a control has never stopped anybody who can type a URL.
 *
 * Taking a listing down asks for a reason first. The owner is shown
 * it, and the audit entry keeps it.
 */
export default function BusinessesClient({
  rows,
  tally,
  activeStatus,
  query,
  canModerate,
  canVerify,
}: {
  rows: AdminBusinessRow[];
  tally: Record<string, number>;
  activeStatus: string;
  query: string;
  canModerate: boolean;
  canVerify: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(query);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ id: string; action: BusinessAction } | null>(null);
  const [reason, setReason] = useState("");

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    router.push(`/admin/businesses?${next.toString()}`);
  }

  async function act(id: string, action: BusinessAction, why?: string) {
    setBusy(id + action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: why }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "تعذّر تنفيذ الإجراء");
        return;
      }
      setAsking(null);
      setReason("");
      router.refresh();
    } catch {
      setError("تعذّر الاتصال");
    } finally {
      setBusy(null);
    }
  }

  const tabs: { id: string; label: string }[] = [
    { id: "", label: "الكل" },
    { id: "PENDING", label: STATUS_LABELS.PENDING.ar },
    { id: "APPROVED", label: STATUS_LABELS.APPROVED.ar },
    { id: "SUSPENDED", label: STATUS_LABELS.SUSPENDED.ar },
    { id: "REJECTED", label: STATUS_LABELS.REJECTED.ar },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => go({ status: t.id || null })}
            aria-pressed={activeStatus === t.id}
            className={cn(
              "min-h-10 rounded-full border px-3.5 text-[0.8125rem] transition-colors",
              activeStatus === t.id
                ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)] font-bold text-[var(--color-jade)]"
                : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]",
            )}
          >
            {t.label}
            {t.id && tally[t.id] ? <span className="num ms-1.5 opacity-70">{tally[t.id]}</span> : null}
          </button>
        ))}

        <form
          className="ms-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q.trim() || null });
          }}
        >
          <div className="relative">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-[var(--color-subtle)]"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="اسم، رابط، أو إيميل المالك"
              aria-label="دوّر على نشاط"
              className="min-h-10 w-[16rem] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] ps-9 pe-3 text-[0.8125rem] outline-none focus:border-[var(--color-jade)]"
            />
          </div>
          <button type="submit" className="btn btn-outline btn-sm">دوّر</button>
        </form>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-[0.875rem] text-[var(--color-subtle)]">
          مفيش أعمال بالمواصفات دي.
        </div>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {rows.map((b) => (
            <li key={b.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.9375rem] font-bold text-[var(--color-ink)]">
                      {b.name}
                    </span>
                    <Pill tone={STATUS_LABELS[b.status].tone}>{STATUS_LABELS[b.status].ar}</Pill>
                    {b.isVerified && <Pill tone="ok">موثّق</Pill>}
                    {b.isFeatured && (
                      <Pill tone="warn">
                        <Star size={9} className="inline" aria-hidden="true" /> مميّز
                      </Pill>
                    )}
                    {!b.isPublished && <Pill>غير منشور</Pill>}
                    <Pill>{b.plan}</Pill>
                  </div>
                  <p className="m-0 mt-1 text-[0.78125rem] text-[var(--color-subtle)]">
                    {b.category} · {b.city} · {b.ownerName ?? "—"}{" "}
                    <span dir="ltr">{b.ownerEmail ?? ""}</span>
                  </p>
                  <p className="num m-0 mt-0.5 text-[0.6875rem] text-[var(--color-subtle)]">
                    {b.bookings} حجز · {b.services} خدمة · انضم {when(b.createdAt)}
                    {b.statusChangedAt ? ` · آخر قرار ${when(b.statusChangedAt)}` : ""}
                  </p>
                  {b.statusNote && (
                    <p className="m-0 mt-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-[0.75rem] text-[var(--color-muted)]">
                      السبب: {b.statusNote}
                    </p>
                  )}
                </div>

                <Link
                  href={`/company/${b.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 shrink-0 items-center gap-1 text-[0.75rem] font-bold text-[var(--color-jade)]"
                >
                  <ExternalLink size={11} aria-hidden="true" />
                  الصفحة
                </Link>
              </div>

              {(canModerate || canVerify) && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-3">
                  {canModerate &&
                    (["approve", "reject", "suspend", "reinstate"] as BusinessAction[])
                      .filter((a) => canApply(a, b.status))
                      .map((a) => (
                        <ActBtn
                          key={a}
                          busy={busy === b.id + a}
                          tone={a === "reject" || a === "suspend" ? "danger" : "ok"}
                          onClick={() => {
                            if (a === "reject" || a === "suspend") setAsking({ id: b.id, action: a });
                            else void act(b.id, a);
                          }}
                        >
                          {ACTION_LABELS[a].ar}
                        </ActBtn>
                      ))}

                  {canVerify &&
                    (b.isVerified
                      ? canApply("unverify", b.status) && (
                          <ActBtn busy={busy === b.id + "unverify"} onClick={() => void act(b.id, "unverify")}>
                            {ACTION_LABELS.unverify.ar}
                          </ActBtn>
                        )
                      : canApply("verify", b.status) && (
                          <ActBtn busy={busy === b.id + "verify"} onClick={() => void act(b.id, "verify")}>
                            {ACTION_LABELS.verify.ar}
                          </ActBtn>
                        ))}

                  {canModerate &&
                    (b.isFeatured
                      ? canApply("unfeature", b.status) && (
                          <ActBtn busy={busy === b.id + "unfeature"} onClick={() => void act(b.id, "unfeature")}>
                            {ACTION_LABELS.unfeature.ar}
                          </ActBtn>
                        )
                      : canApply("feature", b.status) && (
                          <ActBtn busy={busy === b.id + "feature"} onClick={() => void act(b.id, "feature")}>
                            {ACTION_LABELS.feature.ar}
                          </ActBtn>
                        ))}
                </div>
              )}

              {asking?.id === b.id && (
                <form
                  className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(b.id, asking.action, reason);
                  }}
                >
                  <p className="m-0 mb-2 text-[0.78125rem] font-bold text-[var(--color-danger)]">
                    {ACTION_LABELS[asking.action].ar} — صاحب المكان هيشوف السبب ده
                  </p>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    required
                    maxLength={1000}
                    autoFocus
                    aria-label="السبب"
                    className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 text-[0.8125rem] outline-none focus:border-[var(--color-jade)]"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="submit" disabled={!reason.trim()} className="btn btn-primary btn-sm">
                      تأكيد
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAsking(null);
                        setReason("");
                      }}
                      className="btn btn-ghost btn-sm"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActBtn({
  onClick,
  busy,
  tone,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  tone?: "ok" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[0.78125rem] font-bold transition-colors disabled:opacity-60",
        tone === "danger"
          ? "border-[var(--color-danger)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
          : tone === "ok"
            ? "border-[var(--color-jade)] text-[var(--color-jade)] hover:bg-[var(--color-jade-tint)]"
            : "border-[var(--color-line-2)] text-[var(--color-muted)] hover:border-[var(--color-ink)]",
      )}
    >
      {busy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
