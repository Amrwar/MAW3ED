import Link from "@/components/shared/LocaleLink";
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
  onDark = false,
  singleLine = false,
}: {
  items: Crumb[];
  lang: "ar" | "en";
  label: string;
  className?: string;
  /** On a --color-night bar, where the light-surface colours vanish. */
  onDark?: boolean;
  /**
   * Never wrap: the earlier crumbs keep their width and the last one is
   * cut short with an ellipsis. For a phone, where a long business name
   * pushed the trail onto two lines.
   */
  singleLine?: boolean;
}) {
  if (items.length === 0) return null;
  const Separator = lang === "ar" ? ChevronLeft : ChevronRight;

  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ol className={cn("m-0 flex list-none items-center gap-1 p-0 text-[0.8125rem]", singleLine ? "flex-nowrap" : "flex-wrap")}>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className={cn("flex min-w-0 items-center gap-1", singleLine && !last && "shrink-0")}>
              {i > 0 && (
                <Separator
                  size={13}
                  aria-hidden="true"
                  className={cn("shrink-0", onDark ? "text-[var(--color-night-subtle)]" : "text-[var(--color-subtle)]")}
                />
              )}
              {last || !item.href ? (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn("flex min-h-11 min-w-0 items-center font-bold", onDark ? "text-[var(--color-inverse)]" : "text-[var(--color-ink)]")}
                  title={item.label}
                >
                  {/* The ellipsis goes on an inner box: bare text in a
                      flex container is clipped without one. */}
                  <span className="truncate">{item.label}</span>
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={cn("flex min-h-11 min-w-0 items-center transition-colors", onDark ? "text-[var(--color-night-text)] hover:text-[var(--color-inverse)]" : "text-[var(--color-muted)] hover:text-[var(--color-jade)]")}
                >
                  <span className="truncate">{item.label}</span>
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
