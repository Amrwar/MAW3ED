/**
 * What needs a venue manager's attention: the operational exceptions
 * the console shows at the top.
 *
 * Built only from the venue's own records — its requests, tenants,
 * gates, policy, hours and notices. Pure, so each rule is tested.
 */

export type AttentionKind =
  | "pending-requests"
  | "tenant-hidden"
  | "tenant-branch-closed"
  | "gate-inactive-allowed"
  | "no-hours"
  | "no-instructions"
  | "notice-today";

export interface AttentionItem {
  kind: AttentionKind;
  /** Higher first. */
  severity: 1 | 2 | 3;
  count: number;
  ar: string;
  en: string;
  /** The businesses concerned, by name, when there are any. */
  names?: string[];
}

export interface AttentionInput {
  memberships: { status: string; businessName: string; businessPublished: boolean; branchActive: boolean | null }[];
  gates: { id: string; isActive: boolean }[];
  allowedGateIds: string[];
  visitorEligibility: string | null;
  hasInstructions: boolean;
  hoursCount: number;
  isPublished: boolean;
  notices: { kind: string; startsOn: string; endsOn: string }[];
  today: string;
}

export function venueAttention(i: AttentionInput): AttentionItem[] {
  const out: AttentionItem[] = [];
  const pending = i.memberships.filter((m) => m.status === "REQUESTED");
  if (pending.length) {
    out.push({
      kind: "pending-requests", severity: 3, count: pending.length, names: pending.map((m) => m.businessName),
      ar: `${pending.length} طلب مستني قرارك`, en: `${pending.length} request(s) waiting for your decision`,
    });
  }
  const approved = i.memberships.filter((m) => m.status === "APPROVED");
  const hidden = approved.filter((m) => !m.businessPublished);
  if (hidden.length) {
    out.push({
      kind: "tenant-hidden", severity: 2, count: hidden.length, names: hidden.map((m) => m.businessName),
      ar: `${hidden.length} نشاط مقبول بس صفحته مش منشورة — مش ظاهر للزوار`,
      en: `${hidden.length} approved business(es) whose own page is not public — not shown to visitors`,
    });
  }
  const closed = approved.filter((m) => m.branchActive === false);
  if (closed.length) {
    out.push({
      kind: "tenant-branch-closed", severity: 2, count: closed.length, names: closed.map((m) => m.businessName),
      ar: `${closed.length} نشاط مقبول بفرع متقفل — مش ظاهر للزوار`,
      en: `${closed.length} approved business(es) whose branch is switched off — not shown to visitors`,
    });
  }
  const inactiveAllowed = i.allowedGateIds.filter((id) => !i.gates.some((g) => g.id === id && g.isActive));
  if (inactiveAllowed.length) {
    out.push({
      kind: "gate-inactive-allowed", severity: 2, count: inactiveAllowed.length,
      ar: "سياسة الدخول فيها بوابة متوقفة أو اتمسحت", en: "The access policy names a gate that is inactive or deleted",
    });
  }
  if (i.isPublished && i.hoursCount === 0) {
    out.push({ kind: "no-hours", severity: 1, count: 1, ar: "المكان منشور من غير مواعيد فتح", en: "The venue is public without opening hours" });
  }
  if (i.isPublished && i.visitorEligibility && i.visitorEligibility !== "OPEN" && !i.hasInstructions) {
    out.push({
      kind: "no-instructions", severity: 2, count: 1,
      ar: "الدخول مش مفتوح للكل ومفيش تعليمات دخول منشورة", en: "Entry is restricted but no access instructions are published",
    });
  }
  const today = i.notices.filter((n) => n.startsOn <= i.today && n.endsOn >= i.today);
  if (today.length) {
    out.push({ kind: "notice-today", severity: 1, count: today.length, ar: "في تنبيه شغال النهارده", en: "A notice is in effect today" });
  }
  return out.sort((a, b) => b.severity - a.severity);
}
