/**
 * Feature flags: kill switches for whole features, read from the
 * environment so turning one off is a Vercel env change and a redeploy —
 * no code, no database (docs/enterprise/OPERATIONS_RUNBOOK.md).
 *
 * FEATURE_FLAGS_OFF="enterpriseApi,webhooks" switches those off. Every
 * flag is on unless named there, so a missing variable changes nothing.
 */
export const FLAGS = ["enterpriseApi", "webhooks", "automations", "waitlist"] as const;
export type Flag = (typeof FLAGS)[number];

export function flagOn(flag: Flag, env: string | undefined = process.env.FEATURE_FLAGS_OFF): boolean {
  if (!env) return true;
  const off = env.split(",").map((s) => s.trim()).filter(Boolean);
  return !off.includes(flag);
}
