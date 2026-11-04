"use client";

import type { FunnelStep } from "@prisma/client";
import { useFunnelStep } from "@/lib/analytics/funnel-client";

/**
 * Reports that this page was reached as a funnel step, once per tab and
 * day (lib/analytics/funnel-client.ts). Renders nothing. Server pages drop
 * it in; the browser decides nothing but that a real session happened.
 */
export default function FunnelView({
  step,
  business = null,
  org = null,
}: {
  step: FunnelStep;
  business?: string | null;
  org?: string | null;
}) {
  useFunnelStep(step, { business, org });
  return null;
}
