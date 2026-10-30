import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Tiles } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";
import { computeFunnel, STEP_LABELS } from "@/lib/admin/funnel";

export const generateMetadata = adminMetadata("reports.read", "مسار التسجيل");

const WINDOWS = [7, 30, 90, 365] as const;

/**
 * Does onboarding work? The accounts that registered a business in the
 * window, and how far each got (lib/admin/funnel.ts). Counts only — no
 * names — because the question is about the product, not about anyone.
 */
export default async function AdminOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireAdminPage("reports.read");
  const { days: raw } = await searchParams;
  const days = WINDOWS.find((d) => String(d) === raw) ?? 30;

  // One clock read per request, in a server component.
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);

  // Everyone who registered or started in the window, then all of their
  // milestones, whenever they happened.
  const starters = await db.lifecycleEvent.findMany({
    where: { kind: { in: ["BUSINESS_REGISTERED", "ONBOARDING_STARTED"] }, at: { gte: from, lt: to } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const events = starters.length
    ? await db.lifecycleEvent.findMany({
        where: { userId: { in: starters.map((s) => s.userId) } },
        select: { userId: true, kind: true, at: true },
      })
    : [];
  const funnel = computeFunnel(events, from, to);

  return (
    <div>
      <AdminHeading
        title="مسار التسجيل"
        subtitle={`الأنشطة اللي اتسجلت آخر ${days} يوم، ووصلت لحد فين.`}
        action={
          <nav aria-label="الفترة" className="flex gap-2 text-sm">
            {WINDOWS.map((d) => (
              <a
                key={d}
                href={`/admin/onboarding?days=${d}`}
                aria-current={d === days ? "page" : undefined}
                className={d === days ? "font-bold text-[var(--color-ink)]" : "text-[var(--color-jade)] underline"}
              >
                {d} يوم
              </a>
            ))}
          </nav>
        }
      />
      <Tiles
        items={[
          { label: "سجّلوا نشاط", value: String(funnel.cohort) },
          { label: "بدأوا ومكملوش", value: String(funnel.startedNotRegistered) },
          { label: "نشروا", value: String(funnel.steps.find((s) => s.kind === "PUBLISHED")?.count ?? 0) },
          {
            label: "متوسط الوقت للنشر (وسيط)",
            value: funnel.medianHoursToPublish === null ? "—" : `${funnel.medianHoursToPublish} ساعة`,
          },
        ]}
      />
      <AdminTable
        head={["الخطوة", "العدد", "من اللي سجّلوا", "من الخطوة اللي قبلها"]}
        rows={funnel.steps.map((s) => [
          <span key="k" className="font-bold text-[var(--color-ink)]">{STEP_LABELS[s.kind]}</span>,
          <span key="c" className="num">{s.count}</span>,
          <span key="o" className="num">{s.ofCohort}%</span>,
          <span key="p" className="num">{s.ofPrevious}%</span>,
        ])}
        empty="مفيش تسجيلات في الفترة دي."
      />
      <p className="mt-4 text-xs text-[var(--color-subtle)]">
        الأنشطة اللي كانت موجودة قبل المرحلة ٢١ اتسجّل لها التسجيل والنشر وأول حجز من بياناتها، لكن &quot;بدأ التسجيل&quot; و&quot;كمّل الملف&quot; مش متسجلين ليها.
      </p>
    </div>
  );
}
