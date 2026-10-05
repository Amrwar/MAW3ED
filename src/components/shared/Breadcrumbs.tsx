import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  /** Omitted on the last crumb — you are already there. */
  href?: string;
}

/**
 * The trail back up.
 *
 * The separator follows the reading direction, so in Arabic it points
 * left. The last crumb is plain text carrying aria-current, not a link
 * to the page you are on.
 */
export default function Breadcrumbs({
  items,
  lang,
  label,
  className,
}: {
  items: Crumb[];
  lang: "ar" | "en";
  label: string;
  className?: string;
}) {
  if (items.length === 0) return null;
  const Separator = lang === "ar" ? ChevronLeft : ChevronRight;

  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0 text-[0.8125rem]">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <Separator
                  size={13}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-faint)]"
                />
              )}
              {last || !item.href ? (
                <span
                  aria-current={last ? "page" : undefined}
                  className="flex min-h-11 items-center truncate font-bold text-[var(--color-ink)]"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center truncate text-[var(--color-muted)] transition-colors hover:text-[var(--color-jade)]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The same trail as schema.org BreadcrumbList.
 *
 * Built from the identical array the visible nav renders, so the two
 * cannot describe different paths.
 */
export function breadcrumbJsonLd(items: Crumb[], siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${siteUrl}${item.href}` } : {}),
    })),
  };
}
