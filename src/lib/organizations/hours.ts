/**
 * A venue's hours for one Cairo calendar day, from its weekly rules.
 * Pure: the caller passes the day ("2026-10-31", as cairoDateString
 * gives it), so tests do not depend on the clock.
 */
export function todaysHours(
  hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[],
  cairoDay: string,
): { closed: boolean; open: string; close: string } | null {
  const dow = new Date(`${cairoDay}T00:00:00Z`).getUTCDay();
  const rule = hours.find((h) => h.dayOfWeek === dow);
  if (!rule) return null;
  return { closed: rule.isClosed, open: rule.openTime, close: rule.closeTime };
}
