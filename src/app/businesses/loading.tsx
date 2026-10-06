import Skeleton from "@/components/ui/Skeleton";

/**
 * Pending UI for the browse page.
 *
 * This used to live at src/app/loading.tsx, where it wrapped every
 * route in the app. Two things went wrong with that. A boundary above
 * the page means the response starts streaming before the page runs,
 * so notFound() could no longer set a status — every missing business,
 * city and category answered HTTP 200 with not-found markup, which is
 * exactly the soft 404 the SEO work was meant to avoid. And the shape
 * below is a card grid, which is right here and wrong on /pricing,
 * /faq, /terms and a company profile.
 *
 * It is scoped to this segment now: the one page that is a card grid,
 * is the slowest thing a visitor browses through, and never 404s.
 * Everywhere else renders in well under a second, where a skeleton
 * that appears and vanishes reads as a flicker rather than feedback.
 *
 * The navbar strip is reserved too. The old version omitted it, so the
 * header disappeared for the length of the load and came back.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--color-ground)]" aria-busy="true" aria-live="polite">
      <span className="sr-only-label">جارٍ التحميل…</span>

      {/* Navbar strip — same 65px the real header occupies. */}
      <div className="h-[65px] border-b border-[var(--color-line)] bg-[var(--color-surface)]" />

      {/* Search and filter bar */}
      <div className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="container-app py-5">
          <Skeleton className="h-12 w-full max-w-[34rem]" rounded="md" />
        </div>
      </div>

      <div className="container-app flex flex-wrap items-start gap-8 py-10">
        {/* Filter panel, desktop only — matches the real aside. */}
        <aside className="hidden w-[16rem] shrink-0 flex-col gap-6 lg:flex">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-9 w-full" rounded="md" />
              <Skeleton className="h-9 w-5/6" rounded="md" />
            </div>
          ))}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ms-auto h-4 w-20" />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-[8.5rem] w-full" rounded="lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
