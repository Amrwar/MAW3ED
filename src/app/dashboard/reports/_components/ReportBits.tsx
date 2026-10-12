"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { money, num } from "@/lib/fmt";

/**
 * The pieces every report is built from.
 *
 * A bar chart here is bars with numbers on them, not a charting
 * library: the data is a handful of days, and a reader needs the figure
 * more than the curve.
 */

export function Figures({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
      {items.map((f) => (
        <li key={f.label} className="card p-4">
          <p className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">{f.label}</p>
          <p className="num m-0 mt-1 text-[1.25rem] font-bold leading-none text-[var(--color-ink)]">
            {f.value}
          </p>
          {f.hint && (
            <p className="m-0 mt-1 text-[0.6875rem] text-[var(--color-subtle)]">{f.hint}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Bars({
  title,
  rows,
  kind = "count",
  empty,
}: {
  title: string;
  rows: { label: string; value: number; sub?: string }[];
  kind?: "count" | "money";
  empty: string;
}) {
  const { lang } = useLanguage();
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <section className="card overflow-hidden">
      <header className="border-b border-[var(--color-line)] px-5 py-3.5">
        <h2 className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">{title}</h2>
      </header>

      {rows.length === 0 ? (
        <p className="m-0 px-5 py-8 text-center text-[0.8125rem] text-[var(--color-subtle)]">
          {empty}
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2.5 p-5">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[0.8125rem] text-[var(--color-ink-2)]">
                  {r.label}
                  {r.sub && (
                    <span className="num ms-2 text-[0.6875rem] text-[var(--color-subtle)]">
                      {r.sub}
                    </span>
                  )}
                </span>
                <span className="num shrink-0 text-[0.8125rem] font-bold text-[var(--color-ink)]">
                  {kind === "money" ? money(r.value, lang) : num(r.value, lang)}
                </span>
              </div>
              <span
                aria-hidden="true"
                className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]"
              >
                <span
                  className="block h-full rounded-full bg-[var(--color-jade)]"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A plain table, for rows that are read rather than compared. */
export function Rows({
  title,
  head,
  rows,
  empty,
}: {
  title: string;
  head: string[];
  rows: (string | number)[][];
  empty: string;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="border-b border-[var(--color-line)] px-5 py-3.5">
        <h2 className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">{title}</h2>
      </header>

      {rows.length === 0 ? (
        <p className="m-0 px-5 py-8 text-center text-[0.8125rem] text-[var(--color-subtle)]">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.8125rem]">
            <thead>
              <tr>
                {head.map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`whitespace-nowrap border-b border-[var(--color-line)] px-5 py-2.5 text-[0.6875rem] font-bold text-[var(--color-subtle)] ${
                      i === 0 ? "text-start" : "text-end"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`border-b border-[var(--color-line)] px-5 py-3 last:border-0 ${
                        ci === 0
                          ? "text-start font-bold text-[var(--color-ink)]"
                          : "num text-end text-[var(--color-ink-2)]"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
