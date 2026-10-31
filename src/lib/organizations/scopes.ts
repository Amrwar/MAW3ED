import type { DelegationScope, OrganizationBusinessRelation } from "@prisma/client";

/**
 * The rules of delegation that do not need a database: which scopes
 * exist, which relationship may carry which, and what they are called.
 * Shared by the server (lib/organizations/delegation.ts, which also
 * enforces them) and by the screens that offer them, so a checkbox the
 * screen offers is exactly one the server accepts. The database enforces
 * the same rules again as CHECK constraints.
 */

export const DELEGATION_SCOPES = [
  "RESERVATIONS",
  "CUSTOMERS",
  "SERVICES",
  "STAFF",
  "SCHEDULES",
  "PROFILE",
  "REPORTS",
  "FINANCE",
] as const satisfies readonly DelegationScope[];

/** The relationship types new rows may use; the rest are legacy labels. */
export const RELATIONSHIPS = ["OWNED", "HOSTED", "MANAGED"] as const satisfies readonly OrganizationBusinessRelation[];
export type Relationship = (typeof RELATIONSHIPS)[number];

export const SCOPE_LABELS: Record<DelegationScope, [ar: string, en: string]> = {
  RESERVATIONS: ["الحجوزات", "Reservations"],
  CUSTOMERS: ["العملاء", "Customers"],
  SERVICES: ["الخدمات", "Services"],
  STAFF: ["الفريق", "Staff"],
  SCHEDULES: ["ساعات العمل", "Opening hours"],
  PROFILE: ["بيانات النشاط", "Business profile"],
  REPORTS: ["التقارير", "Reports"],
  FINANCE: ["الإيرادات", "Revenue and finance"],
};

export const RELATIONSHIP_LABELS: Record<Relationship, [ar: string, en: string]> = {
  OWNED: ["مملوك للجهة", "Owned"],
  HOSTED: ["مستضاف عندها", "Hosted"],
  MANAGED: ["تديره الجهة", "Managed"],
};

/** One line on what each relationship means, for the screens that offer it. */
export const RELATIONSHIP_HINTS: Record<Relationship, [ar: string, en: string]> = {
  OWNED: [
    "الجهة بتملك النشاط أو بتتحكم فيه. تقدر تديره في حدود الصلاحيات اللي صاحب حساب النشاط بيديها.",
    "The organization owns or controls the business. It may operate it within the scopes the business account grants.",
  ],
  HOSTED: [
    "النشاط مستقل وموجود في مكان الجهة (مول، كمبوند…). ظهور في الدليل بس — من غير أي وصول لبيانات النشاط.",
    "An independent business trading at the organization's place (mall, compound…). Directory listing only — no access to the business's data.",
  ],
  MANAGED: [
    "شركة بتدير وظايف محددة للنشاط (زي الحجوزات) بصلاحيات مفوّضة، ممكن تنتهي في تاريخ.",
    "A company running selected functions (such as bookings) under delegated scopes, optionally until a date.",
  ],
};

/**
 * The scopes a relationship may carry at all:
 *  - HOSTED carries none.
 *  - FINANCE only to an owner.
 *  - A relationship limited to one branch can only run that branch's
 *    reservations: customers, services, staff, hours, profile and reports
 *    are business-wide and would show the other branches.
 */
export function allowedScopes(relation: OrganizationBusinessRelation | string, branchId: string | null): DelegationScope[] {
  if (relation === "HOSTED" || !RELATIONSHIPS.includes(relation as Relationship)) return [];
  if (branchId) return ["RESERVATIONS"];
  return relation === "OWNED" ? [...DELEGATION_SCOPES] : DELEGATION_SCOPES.filter((s) => s !== "FINANCE");
}

/** Every requested scope must be allowed; returns them de-duplicated in canonical order. */
export function checkScopes(
  relation: OrganizationBusinessRelation | string,
  branchId: string | null,
  scopes: readonly string[],
): { ok: true; scopes: DelegationScope[] } | { ok: false; refused: string[] } {
  const allowed = allowedScopes(relation, branchId);
  const refused = scopes.filter((s) => !allowed.includes(s as DelegationScope));
  if (refused.length) return { ok: false, refused: [...new Set(refused)] };
  return { ok: true, scopes: DELEGATION_SCOPES.filter((s) => scopes.includes(s)) };
}
