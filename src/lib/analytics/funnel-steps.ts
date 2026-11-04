import type { FunnelStep } from "@prisma/client";

/**
 * The steps a browser may report, in funnel order. Pure (no database), so
 * the client hook and the route share one list. docs/analytics/
 * EVENT_TAXONOMY.md describes each.
 */
export const FUNNEL_STEPS = [
  "MARKETPLACE_VIEW",
  "SEARCH",
  "ORGANIZATION_VIEW",
  "BUSINESS_VIEW",
  "SERVICE_SELECTED",
  "BOOKING_STARTED",
  "TIME_SELECTED",
  "FOR_BUSINESS_VIEW",
  "PRICING_VIEW",
  "DEMO_VIEW",
  "SIGNUP_VIEW",
] as const satisfies readonly FunnelStep[];

/** Steps about one business: a published business slug is required. */
export const BUSINESS_STEPS: readonly FunnelStep[] = ["BUSINESS_VIEW", "SERVICE_SELECTED", "BOOKING_STARTED", "TIME_SELECTED"];

/** Steps about the site, not one business or organization. */
export const PLAIN_STEPS: readonly FunnelStep[] = [
  "MARKETPLACE_VIEW",
  "SEARCH",
  "FOR_BUSINESS_VIEW",
  "PRICING_VIEW",
  "DEMO_VIEW",
  "SIGNUP_VIEW",
];

/** The customer booking funnel, as reported by browsers, in order. */
export const CUSTOMER_FUNNEL: readonly FunnelStep[] = [
  "MARKETPLACE_VIEW",
  "SEARCH",
  "BUSINESS_VIEW",
  "SERVICE_SELECTED",
  "BOOKING_STARTED",
  "TIME_SELECTED",
];

/** The business acquisition funnel, as reported by browsers, in order. */
export const ACQUISITION_FUNNEL: readonly FunnelStep[] = ["FOR_BUSINESS_VIEW", "PRICING_VIEW", "DEMO_VIEW", "SIGNUP_VIEW"];
