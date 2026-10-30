import { currentCaller } from "@/lib/api";

/**
 * Whether the person asking owns this business, so may see and try its
 * page before it is published.
 *
 * Owner only, read from the session (cookie or app token) and compared
 * with the business row — never from a query parameter. Everybody else
 * gets exactly what they got before: an unpublished business does not
 * exist. Staff do not preview: publishing is the owner's decision.
 */
export async function isOwnerPreview(business: { ownerId: string; isPublished: boolean }): Promise<boolean> {
  if (business.isPublished) return false;
  const caller = await currentCaller().catch(() => null);
  return !!caller && caller.user.id === business.ownerId;
}
