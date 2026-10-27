import Link from "@/components/shared/LocaleLink";
import { cn } from "@/lib/utils";

/**
 * Previous / "page x of y" / next, as plain links.
 *
 * For server-rendered lists, where the page lives in the URL: it works
 * without JavaScript and the back button does what it should. The
 * interactive tables use components/ui/Pagination instead.
 *
 * `query` is carried over to every link, so filters survive paging.
 */
export default function LinkPager({
  page,
  totalPages,
  basePath,
  query = {},
  labels,
  className,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
  labels: { previous: string; next: string; page: string; of: string; nav: string };
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const box =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 text-[0.875rem] font-semibold text-[var(--color-ink)]";
  const off = "pointer-events-none text-[var(--color-subtle)] opacity-60";

  return (
    <nav aria-label={labels.nav} className={cn("flex flex-wrap items-center justify-center gap-3", className)}>
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={box}>
          {labels.previous}
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(box, off)}>
          {labels.previous}
        </span>
      )}
      <span className="num text-[0.8125rem] text-[var(--color-muted)]" aria-current="page">
        {labels.page} {page} {labels.of} {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" className={box}>
          {labels.next}
        </Link>
      ) : (
        <span aria-disabled="true" className={cn(box, off)}>
          {labels.next}
        </span>
      )}
    </nav>
  );
}
