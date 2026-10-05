import Skeleton from "@/components/ui/Skeleton";

/**
 * Pending UI for the dashboard shell. Mirrors the real layout — header
 * row, four KPI tiles, then the wide/narrow column split — so the page
 * settles into place rather than reflowing when data arrives.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only-label">جارٍ تحميل لوحة التحكم…</span>

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-56" rounded="md" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-12 w-36" rounded="md" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5"
          >
            <Skeleton className="h-11 w-11" rounded="md" />
            <Skeleton className="mt-4 h-7 w-24" rounded="md" />
            <Skeleton className="mt-3 h-3.5 w-28" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_32rem]">
          <Skeleton className="h-[22rem] w-full" rounded="lg" />
        </div>
        <div className="flex-[0_1_19rem] min-w-[16rem]">
          <Skeleton className="h-[16rem] w-full" rounded="lg" />
        </div>
      </div>
    </div>
  );
}
