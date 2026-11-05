/**
 * An association that still grants anything: not expired, of an
 * organization the platform still approves (the status, suspension and
 * scope filters are added by each caller). One definition, so the reports
 * that read an organization's brands agree on what "live" means (final
 * audit F-25).
 */
export function liveGrant(now: Date) {
  return {
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    organization: { status: "APPROVED" as const },
  };
}
