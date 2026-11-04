/**
 * Where "book again" goes: the business page with the same service, and
 * the same member of staff when there was one, already chosen
 * (BookingWidget reads ?service= and ?staff=). Ids only — nothing about
 * the customer travels in the link.
 */
export function rebookHref(slug: string, serviceId: string | null, staffMemberId?: string | null): string {
  const q = new URLSearchParams();
  if (serviceId) q.set("service", serviceId);
  if (staffMemberId) q.set("staff", staffMemberId);
  const qs = q.toString();
  return `/company/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}#booking`;
}
