"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { useState, useTransition } from "react";
import { AlertTriangle, Search, StickyNote, Users, X } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import { useLanguage } from "@/contexts/LanguageContext";
import { arCount, enCount, money, num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

const CUST = { one: "عميل واحد", two: "عميلين", few: "عملاء", many: "عميل" };

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  hasNotes: boolean;
  visits: number;
  cancelled: number;
  noShows: number;
  spend: number;
  noShowRate: number | null;
  lastVisit: string | null;
  nextVisit: string | null;
}

/**
 * Who has been here, and what happened.
 *
 * Search and filters live in the URL, so a business can send a colleague
 * a link to "everyone who has missed an appointment" and it opens the
 * same thing. Sorting and paging go through the server for the same
 * reason — the list is the query, not a client-side state.
 */
export default function CustomersClient({
  rows,
  total,
  page,
  perPage,
  allTags,
}: {
  rows: CustomerRow[];
  total: number;
  page: number;
  perPage: number;
  allTags: string[];
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    // Any change to the filters starts from the first page; staying on
    // page 4 of a different result set shows an empty screen.
    if (!("page" in patch)) next.delete("page");
    startTransition(() => router.push(`/dashboard/customers?${next.toString()}`));
  }

  const activeTag = params.get("tag");
  const onlyNoShows = params.get("noShows") === "1";
  const onlyReturning = params.get("returning") === "1";
  const sort = params.get("sort") ?? "recent";
  const filtered = Boolean(q || activeTag || onlyNoShows || onlyReturning);

  const date = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(iso))
      : "—";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">
            {ar ? "العملاء" : "Customers"}
          </h1>
          <p className="m-0 mt-1 text-[0.8125rem] text-[var(--color-subtle)]">
            {total === 0
              ? ar
                ? "لسه مفيش عملاء"
                : "No customers yet"
              : ar
                ? arCount(total, CUST)
                : enCount(total, "customer")}
          </p>
        </div>
      </header>

      {/* ── Search and filters ─────────────────────────────── */}
      <div className="card space-y-3 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply({ q: q.trim() || null });
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-[var(--color-subtle)]"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ar ? "دوّر بالاسم أو الرقم" : "Search by name or number"}
              aria-label={ar ? "دوّر بالاسم أو الرقم" : "Search by name or number"}
              className="min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] ps-9 pe-3 text-[0.875rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-jade)]"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">
            {ar ? "دوّر" : "Search"}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={onlyReturning}
            onClick={() => apply({ returning: onlyReturning ? null : "1" })}
          >
            {ar ? "عملاء بيرجعوا" : "Returning"}
          </FilterChip>
          <FilterChip
            active={onlyNoShows}
            onClick={() => apply({ noShows: onlyNoShows ? null : "1" })}
          >
            {ar ? "غابوا قبل كده" : "Has missed one"}
          </FilterChip>

          {allTags.map((tag) => (
            <FilterChip
              key={tag}
              active={activeTag === tag}
              onClick={() => apply({ tag: activeTag === tag ? null : tag })}
            >
              {tag}
            </FilterChip>
          ))}

          <div className="ms-auto flex items-center gap-2">
            <label className="text-[0.75rem] text-[var(--color-subtle)]" htmlFor="cust-sort">
              {ar ? "ترتيب" : "Sort"}
            </label>
            <select
              id="cust-sort"
              value={sort}
              onChange={(e) => apply({ sort: e.target.value })}
              className="min-h-9 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-[0.8125rem] text-[var(--color-ink)]"
            >
              <option value="recent">{ar ? "الأحدث" : "Most recent"}</option>
              <option value="visits">{ar ? "الأكتر زيارة" : "Most visits"}</option>
              <option value="spend">{ar ? "الأكتر إنفاقًا" : "Highest spend"}</option>
              <option value="name">{ar ? "الاسم" : "Name"}</option>
            </select>
          </div>
        </div>

        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              startTransition(() => router.push("/dashboard/customers"));
            }}
            className="inline-flex min-h-9 items-center gap-1 text-[0.78125rem] font-bold text-[var(--color-jade)]"
          >
            <X size={13} aria-hidden="true" />
            {ar ? "امسح الفلاتر" : "Clear filters"}
          </button>
        )}
      </div>

      {/* ── The list ───────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={24} strokeWidth={1.7} />}
            title={
              filtered
                ? ar
                  ? "مفيش حد بالمواصفات دي"
                  : "Nobody matches that"
                : ar
                  ? "لسه مفيش عملاء"
                  : "No customers yet"
            }
            body={
              filtered
                ? ar
                  ? "جرّب تغيّر البحث أو تشيل فلتر."
                  : "Try a different search, or remove a filter."
                : ar
                  ? "أول ما حد يحجز، هيبان هنا بكل تاريخه."
                  : "The first person to book will appear here with their whole history."
            }
          />
        </div>
      ) : (
        <>
          <ul className="m-0 list-none space-y-2 p-0">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/customers/${c.id}`}
                  className="card card-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.9375rem] font-bold text-[var(--color-ink)]">
                        {c.name}
                      </span>
                      {c.hasNotes && (
                        <StickyNote
                          size={13}
                          aria-label={ar ? "فيه ملاحظات" : "Has notes"}
                          className="text-[var(--color-subtle)]"
                        />
                      )}
                      {c.noShows > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-[0.6875rem] font-bold text-[var(--color-danger)]">
                          <AlertTriangle size={10} aria-hidden="true" />
                          {ar ? `غاب ${num(c.noShows, lang)}` : `${num(c.noShows, lang)} missed`}
                        </span>
                      )}
                    </div>

                    <p className="num m-0 mt-0.5 text-[0.78125rem] text-[var(--color-subtle)]" dir="ltr">
                      {c.phone}
                    </p>

                    {c.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[var(--color-surface-3)] px-2 py-0.5 text-[0.6875rem] text-[var(--color-muted)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <dl className="m-0 grid shrink-0 grid-cols-3 gap-x-5 gap-y-1 text-[0.75rem] sm:w-[22rem]">
                    <Stat label={ar ? "زيارات" : "Visits"} value={num(c.visits, lang)} />
                    <Stat
                      label={ar ? "أنفق" : "Spent"}
                      value={c.spend > 0 ? money(c.spend, lang) : "—"}
                    />
                    <Stat
                      label={ar ? "آخر زيارة" : "Last visit"}
                      value={date(c.lastVisit)}
                    />
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / perPage))}
            onPageChange={(p: number) => apply({ page: String(p) })}
          />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">{label}</dt>
      <dd className="num m-0 mt-0.5 font-bold text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-9 rounded-full border px-3 text-[0.78125rem] transition-colors",
        active
          ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)] font-bold text-[var(--color-jade)]"
          : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:border-[var(--color-jade)]/40",
      )}
    >
      {children}
    </button>
  );
}
