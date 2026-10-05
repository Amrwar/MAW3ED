import Skeleton from "@/components/ui/Skeleton";

/**
 * Route-level pending UI. Next.js shows this while a server component
 * segment streams, so a navigation has visible feedback instead of the
 * previous page sitting frozen.
 *
 * Deliberately a shape, not a spinner: it reserves the layout the page
 * is about to fill, which keeps the content from jumping in.
 */
export default function Loading() {
  return (
    <div className="bg-[var(--color-ground)]" aria-busy="true" aria-live="polite">
      <span className="sr-only-label">جارٍ التحميل…</span>

      <div className="container-app py-14">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-12 w-full max-w-[26rem]" rounded="md" />
          <Skeleton className="h-4 w-full max-w-[34rem]" />
        </div>

        <div className="mt-12 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3">
              <Skeleton className="h-[8.5rem] w-full" rounded="lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
