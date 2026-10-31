/**
 * Shown while an organization page loads: the page's own shape in grey,
 * so the layout does not jump when the directory arrives.
 */
export default function Loading() {
  return (
    <main id="main" className="mx-auto max-w-5xl space-y-6 px-4 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">جاري التحميل… / Loading…</span>
      <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-3)]" />
      <div className="h-6 w-1/3 animate-pulse rounded bg-[var(--color-surface-3)]" />
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="h-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-3)]" />
        ))}
      </ul>
    </main>
  );
}
