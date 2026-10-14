/** A ?page= value as a page number: anything but a positive integer is 1. */
export function readPage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 100_000) : 1;
}

/** The admin is Arabic-only, so its pager is too. */
export const ADMIN_PAGER_LABELS = {
  previous: "السابق",
  next: "التالي",
  page: "صفحة",
  of: "من",
  nav: "صفحات الجدول",
};
