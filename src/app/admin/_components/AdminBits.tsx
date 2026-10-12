import Link from "next/link";

/**
 * The pieces every admin section is built from.
 *
 * Server components with no state: a list of records is a table and a
 * heading, and each section differs only in what the columns say.
 */

export function AdminHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        {subtitle && (
          <p className="m-0 mt-1 text-[0.8125rem] text-[var(--color-subtle)]">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}

export function Tiles({
  items,
}: {
  items: { label: string; value: string; hint?: string; href?: string }[];
}) {
  return (
    <ul className="m-0 mb-6 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
      {items.map((t) => {
        const inner = (
          <>
            <p className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">{t.label}</p>
            <p className="num m-0 mt-1 text-[1.375rem] font-bold leading-none text-[var(--color-ink)]">
              {t.value}
            </p>
            {t.hint && (
              <p className="m-0 mt-1 text-[0.6875rem] text-[var(--color-subtle)]">{t.hint}</p>
            )}
          </>
        );
        return (
          <li key={t.label}>
            {t.href ? (
              <Link href={t.href} className="card card-hover block p-4">
                {inner}
              </Link>
            ) : (
              <div className="card p-4">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A plain table. `head` and each row must have the same length. */
export function AdminTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="card p-10 text-center text-[0.875rem] text-[var(--color-subtle)]">
        {empty}
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-[0.84375rem]">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h + i}
                scope="col"
                className={`whitespace-nowrap border-b border-[var(--color-line)] px-4 py-3 text-[0.6875rem] font-bold text-[var(--color-subtle)] ${
                  i === 0 ? "text-start" : "text-start"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="align-top">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className="border-b border-[var(--color-line)] px-4 py-3 last:border-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TONE_CLASS: Record<string, string> = {
  ok: "bg-[var(--color-jade-tint)] text-[var(--color-jade)]",
  warn: "bg-[var(--color-warn-soft)] text-[var(--color-warn)]",
  danger: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  muted: "bg-[var(--color-surface-3)] text-[var(--color-muted)]",
};

export function Pill({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "ok" | "warn" | "danger" | "muted";
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

/** Dates read the same everywhere in the panel. */
export function when(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
}

export function day(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}
