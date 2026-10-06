import { cairoDateString } from "@/lib/bookings/instants";

/**
 * Today, yesterday, earlier.
 *
 * Grouped by the Cairo day, not by hours elapsed: something that
 * happened at 23:50 last night is "yesterday" at 00:10, even though it
 * was twenty minutes ago. That is how people read a list of their own
 * notifications, and the business and the customer are both in Cairo.
 */

export type Bucket = "today" | "yesterday" | "earlier";

export interface Grouped<T> {
  bucket: Bucket;
  items: T[];
}

/** The Cairo day before the one given, as YYYY-MM-DD. */
function previousDay(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  // Noon UTC, so a day step cannot be undone by a timezone offset.
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  noon.setUTCDate(noon.getUTCDate() - 1);
  return noon.toISOString().slice(0, 10);
}

export function bucketFor(createdAt: Date, now: Date = new Date()): Bucket {
  const day = cairoDateString(createdAt);
  const today = cairoDateString(now);
  if (day === today) return "today";
  if (day === previousDay(today)) return "yesterday";
  return "earlier";
}

/**
 * Buckets a list that is already newest-first, keeping that order and
 * dropping any bucket that has nothing in it — an empty "yesterday"
 * heading above an empty space is noise.
 */
export function groupByDay<T extends { createdAt: Date | string }>(
  rows: T[],
  now: Date = new Date(),
): Grouped<T>[] {
  const order: Bucket[] = ["today", "yesterday", "earlier"];
  const buckets = new Map<Bucket, T[]>();

  for (const row of rows) {
    const at = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
    const bucket = bucketFor(at, now);
    const list = buckets.get(bucket);
    if (list) list.push(row);
    else buckets.set(bucket, [row]);
  }

  return order
    .filter((b) => (buckets.get(b)?.length ?? 0) > 0)
    .map((bucket) => ({ bucket, items: buckets.get(bucket)! }));
}
