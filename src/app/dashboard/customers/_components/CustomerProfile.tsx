"use client";

import { useState } from "react";
import Link from "@/components/shared/LocaleLink";
import {
  ArrowRight,
  Calendar,
  Loader2,
  Mail,
  Phone,
  Plus,
  Star,
  X,
} from "lucide-react";
import Alert from "@/components/ui/Alert";
import StatusBadge from "@/components/ui/StatusBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import { arCount, money, num, clock } from "@/lib/fmt";
import { telHref, whatsappHref } from "@/lib/contact";

const APPT_UP = { one: "ميعاد واحد جاي", two: "ميعادين جايين", few: "مواعيد جاية", many: "ميعاد جاي" };

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  notesUpdatedAt: string | null;
  tags: string[];
  since: string;
}

interface Stats {
  visits: number;
  cancelled: number;
  noShows: number;
  upcoming: number;
  spend: number;
  noShowRate: number | null;
  firstSeen: string | null;
  lastVisit: string | null;
  nextVisit: string | null;
}

interface HistoryRow {
  id: string;
  reference: string | null;
  status: string;
  at: string;
  startTime: string;
  endTime: string | null;
  serviceName: string;
  staffName: string | null;
  price: number;
  currency: string;
  rating: number | null;
}

/**
 * One customer, and everything the business knows about them.
 *
 * The numbers are counted from the appointments listed underneath, so a
 * business can check any of them by scrolling. Notes and tags are the
 * only things stored here; everything else is derived.
 */
export default function CustomerProfile({
  customer,
  stats,
  history,
}: {
  customer: Customer;
  stats: Stats;
  history: HistoryRow[];
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const [notes, setNotes] = useState(customer.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(customer.notes ?? "");
  const [tags, setTags] = useState(customer.tags);
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/business/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? (ar ? "حصل خطأ أثناء الحفظ" : "Could not save"));
        return false;
      }
      return true;
    } catch {
      setError(ar ? "حصل خطأ أثناء الحفظ" : "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (notes === savedNotes) return;
    if (await patch({ notes })) setSavedNotes(notes);
  }

  async function addTag() {
    const t = newTag.trim();
    if (!t || tags.includes(t)) {
      setNewTag("");
      return;
    }
    const next = [...tags, t];
    setTags(next);
    setNewTag("");
    if (!(await patch({ tags: next }))) setTags(tags);
  }

  async function removeTag(t: string) {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    if (!(await patch({ tags: next }))) setTags(tags);
  }

  const date = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(iso))
      : "—";

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/customers"
        className="inline-flex min-h-11 items-center gap-1.5 text-[0.8125rem] font-bold text-[var(--color-jade)]"
      >
        <ArrowRight size={14} className="rtl:rotate-180" aria-hidden="true" />
        {ar ? "كل العملاء" : "All customers"}
      </Link>

      {/* ── Who they are ───────────────────────────────────── */}
      <header className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">
              {customer.name}
            </h1>
            <p className="m-0 mt-1 text-[0.78125rem] text-[var(--color-subtle)]">
              {ar ? "عميل من" : "Customer since"} {date(stats.firstSeen ?? customer.since)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={telHref(customer.phone)} className="btn btn-outline btn-sm btn-pill">
              <Phone size={14} aria-hidden="true" />
              {ar ? "اتصل" : "Call"}
            </a>
            <a
              href={whatsappHref(customer.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm btn-pill"
            >
              {ar ? "واتساب" : "WhatsApp"}
            </a>
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="btn btn-outline btn-sm btn-pill">
                <Mail size={14} aria-hidden="true" />
                {ar ? "إيميل" : "Email"}
              </a>
            )}
          </div>
        </div>

        <dl className="m-0 mt-4 flex flex-wrap gap-x-7 gap-y-2 border-t border-[var(--color-line)] pt-4 text-[0.8125rem]">
          <div>
            <dt className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">
              {ar ? "الموبايل" : "Phone"}
            </dt>
            <dd className="num m-0 font-bold text-[var(--color-ink)]" dir="ltr">
              {customer.phone}
            </dd>
          </div>
          {customer.email && (
            <div className="min-w-0">
              <dt className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">
                {ar ? "الإيميل" : "Email"}
              </dt>
              <dd className="m-0 truncate font-bold text-[var(--color-ink)]" dir="ltr">
                {customer.email}
              </dd>
            </div>
          )}
          <div>
            <dt className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">
              {ar ? "الموعد الجاي" : "Next appointment"}
            </dt>
            <dd className="m-0 font-bold text-[var(--color-ink)]">{date(stats.nextVisit)}</dd>
          </div>
        </dl>
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      {/* ── The record ─────────────────────────────────────── */}
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
        <Tile label={ar ? "زيارات" : "Visits"} value={num(stats.visits, lang)} />
        <Tile
          label={ar ? "أنفق" : "Total spend"}
          value={stats.spend > 0 ? money(stats.spend, lang) : "—"}
          hint={ar ? "من المواعيد اللي تمّت" : "From completed appointments"}
        />
        <Tile label={ar ? "ألغى" : "Cancelled"} value={num(stats.cancelled, lang)} />
        <Tile
          label={ar ? "غاب" : "No-shows"}
          value={num(stats.noShows, lang)}
          hint={
            stats.noShowRate === null
              ? ar
                ? "لسه مفيش موعد يتحسب"
                : "No completed appointment yet"
              : `${num(Math.round(stats.noShowRate * 100), lang)}%`
          }
          tone={stats.noShows > 0 ? "danger" : undefined}
        />
      </ul>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* ── What happened ────────────────────────────────── */}
        <section className="card overflow-hidden">
          <header className="border-b border-[var(--color-line)] px-5 py-3.5">
            <h2 className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">
              {ar ? "تاريخ الحجوزات" : "Booking history"}
            </h2>
          </header>

          {history.length === 0 ? (
            <p className="m-0 px-5 py-10 text-center text-[0.8125rem] text-[var(--color-subtle)]">
              {ar ? "لسه مفيش حجوزات" : "No bookings yet"}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--color-line)] px-5 py-3.5 last:border-0"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[0.875rem] font-bold text-[var(--color-ink)]">
                      {h.serviceName}
                    </span>
                    <span className="num mt-0.5 text-[0.75rem] text-[var(--color-subtle)]">
                      {date(h.at)} · {clock(h.startTime)}
                      {h.staffName ? ` · ${h.staffName}` : ""}
                    </span>
                  </span>

                  {h.rating !== null && (
                    <span className="num inline-flex items-center gap-1 text-[0.75rem] text-[var(--color-star)]">
                      <Star size={12} fill="currentColor" aria-hidden="true" />
                      {num(h.rating, lang)}
                    </span>
                  )}

                  <span className="num text-[0.8125rem] font-bold text-[var(--color-ink)]">
                    {money(h.price, lang, h.currency)}
                  </span>

                  <StatusBadge status={h.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── What the business knows ──────────────────────── */}
        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="m-0 mb-2 text-[0.9375rem] font-bold text-[var(--color-ink)]">
              {ar ? "تصنيفات" : "Tags"}
            </h2>
            <p className="m-0 mb-3 text-[0.75rem] leading-relaxed text-[var(--color-subtle)]">
              {ar
                ? "كلمة أو اتنين تفكّرك بحاجة — «زبون دائم»، «حساسية صبغة»."
                : "A word or two to remind you — “regular”, “prefers mornings”."}
            </p>

            {tags.length > 0 && (
              <ul className="m-0 mb-3 flex list-none flex-wrap gap-1.5 p-0">
                {tags.map((tag) => (
                  <li key={tag}>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-jade-tint)] py-1 pe-1 ps-2.5 text-[0.75rem] font-bold text-[var(--color-jade)]">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={ar ? `شيل ${tag}` : `Remove ${tag}`}
                        className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[var(--color-jade)]/15"
                      >
                        <X size={11} aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addTag();
              }}
              className="flex gap-2"
            >
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder={ar ? "تصنيف جديد" : "New tag"}
                aria-label={ar ? "تصنيف جديد" : "New tag"}
                maxLength={30}
                className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[0.8125rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-jade)]"
              />
              <button
                type="submit"
                disabled={!newTag.trim()}
                className="btn btn-outline btn-sm"
                aria-label={ar ? "زوّد" : "Add"}
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="m-0 mb-2 flex items-center gap-2 text-[0.9375rem] font-bold text-[var(--color-ink)]">
              {ar ? "ملاحظات" : "Notes"}
              {busy && (
                <Loader2 size={13} className="animate-spin text-[var(--color-faint)]" aria-hidden="true" />
              )}
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void saveNotes()}
              rows={6}
              maxLength={2000}
              placeholder={
                ar ? "حاجة تحب تفتكرها عن العميل ده" : "Anything worth remembering"
              }
              className="w-full resize-y rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-[0.8125rem] leading-relaxed text-[var(--color-ink)] outline-none focus:border-[var(--color-jade)]"
            />
            <p className="m-0 mt-2 text-[0.6875rem] text-[var(--color-subtle)]">
              {notes !== savedNotes
                ? ar
                  ? "بيحفظ لما تسيب الخانة"
                  : "Saves when you click away"
                : customer.notesUpdatedAt
                  ? `${ar ? "آخر تعديل" : "Last edited"} ${date(customer.notesUpdatedAt)}`
                  : ""}
            </p>
          </section>

          {stats.upcoming > 0 && (
            <div className="card flex items-center gap-3 p-4">
              <Calendar size={16} className="text-[var(--color-jade)]" aria-hidden="true" />
              <p className="num m-0 text-[0.8125rem] text-[var(--color-ink-2)]">
                {ar
                  ? arCount(stats.upcoming, APPT_UP)
                  : `${num(stats.upcoming, lang)} upcoming`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger";
}) {
  return (
    <li className="card p-4">
      <p className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">{label}</p>
      <p
        className="num m-0 mt-1 text-[1.375rem] font-bold leading-none"
        style={{ color: tone === "danger" ? "var(--color-danger)" : "var(--color-ink)" }}
      >
        {value}
      </p>
      {hint && <p className="m-0 mt-1 text-[0.6875rem] text-[var(--color-subtle)]">{hint}</p>}
    </li>
  );
}
