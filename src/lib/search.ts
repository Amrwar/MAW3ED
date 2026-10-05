/**
 * Search-parameter helpers for /businesses.
 *
 * Kept out of lib/data.ts so they can be unit-tested without pulling
 * in Prisma, and so the hero and the browse page agree on exactly one
 * reading of each parameter.
 */

/** The values the hero's "when" control can post. */
export type WhenParam = "today" | "tomorrow";

/** Narrows an arbitrary query string to a value we understand. */
export function parseWhen(raw: string | undefined): WhenParam | "" {
  return raw === "today" || raw === "tomorrow" ? raw : "";
}

/**
 * Maps the "when" control to a weekday number, 0 = Sunday.
 *
 * "any" is the absence of a filter rather than a value of its own, so
 * it returns null and the caller leaves availability out of the query
 * entirely instead of matching every day.
 *
 * `now` is injectable because "tomorrow" crossing Saturday into
 * Sunday is the case worth pinning down.
 */
export function dayOfWeekFor(
  when: string | undefined,
  now: Date = new Date(),
): number | null {
  const parsed = parseWhen(when);
  if (parsed === "today") return now.getDay();
  if (parsed === "tomorrow") return (now.getDay() + 1) % 7;
  return null;
}
