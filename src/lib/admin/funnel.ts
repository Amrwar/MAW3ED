import type { LifecycleEventKind } from "@prisma/client";

/**
 * The onboarding funnel, as a cohort.
 *
 * Counting each milestone over a date range on its own mixes people: a
 * business that registered last year and published this month would
 * count as a publish with no registration. So the cohort is the
 * accounts that registered a business in the window, and each later
 * step counts how many of those same accounts reached it (whenever they
 * did). Accounts that started the wizard in the window and never
 * finished are counted beside it, as the drop-off before registration.
 *
 * Pure, over the events the page loads.
 */

export const COHORT_STEPS: LifecycleEventKind[] = [
  "BUSINESS_REGISTERED",
  "PROFILE_COMPLETED",
  "PUBLISHED",
  "FIRST_BOOKING",
  "FIRST_COMPLETED_BOOKING",
  "FIRST_PAID_SUBSCRIPTION",
];

export interface FunnelEvent {
  userId: string;
  kind: LifecycleEventKind;
  at: Date;
}

export interface FunnelStep {
  kind: LifecycleEventKind;
  count: number;
  /** Share of the cohort, 0..100. */
  ofCohort: number;
  /** Share of the step before, 0..100. */
  ofPrevious: number;
}

export interface Funnel {
  cohort: number;
  startedNotRegistered: number;
  steps: FunnelStep[];
  /** Median hours from registering to publishing, among those who did. */
  medianHoursToPublish: number | null;
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export function computeFunnel(events: FunnelEvent[], from: Date, to: Date): Funnel {
  const byUser = new Map<string, Map<LifecycleEventKind, Date>>();
  for (const e of events) {
    const m = byUser.get(e.userId) ?? new Map();
    m.set(e.kind, e.at);
    byUser.set(e.userId, m);
  }
  const inWindow = (d: Date | undefined) => !!d && d >= from && d < to;

  const cohort = [...byUser.values()].filter((m) => inWindow(m.get("BUSINESS_REGISTERED")));
  const startedNotRegistered = [...byUser.values()].filter(
    (m) => inWindow(m.get("ONBOARDING_STARTED")) && !m.has("BUSINESS_REGISTERED"),
  ).length;

  const steps: FunnelStep[] = [];
  let previous = cohort.length;
  for (const kind of COHORT_STEPS) {
    const count = cohort.filter((m) => m.has(kind)).length;
    steps.push({ kind, count, ofCohort: pct(count, cohort.length), ofPrevious: pct(count, previous) });
    previous = count;
  }

  const hours = cohort
    .filter((m) => m.has("PUBLISHED"))
    .map((m) => (m.get("PUBLISHED")!.getTime() - m.get("BUSINESS_REGISTERED")!.getTime()) / 3_600_000)
    .filter((h) => h >= 0)
    .sort((a, b) => a - b);
  const medianHoursToPublish = hours.length
    ? Math.round((hours.length % 2 ? hours[(hours.length - 1) / 2] : (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2) * 10) / 10
    : null;

  return { cohort: cohort.length, startedNotRegistered, steps, medianHoursToPublish };
}

export const STEP_LABELS: Record<LifecycleEventKind, string> = {
  ONBOARDING_STARTED: "بدأ التسجيل",
  BUSINESS_REGISTERED: "سجّل النشاط",
  PROFILE_COMPLETED: "كمّل الملف",
  PUBLISHED: "نشر الصفحة",
  FIRST_BOOKING: "أول حجز حقيقي",
  FIRST_COMPLETED_BOOKING: "أول حجز خلص",
  FIRST_PAID_SUBSCRIPTION: "أول اشتراك مدفوع",
};
