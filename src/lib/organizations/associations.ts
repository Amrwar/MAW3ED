import type { OrganizationBusinessRelation } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { randomToken } from "@/lib/tokens";
import { INVITE_DAYS } from "./rules";

/**
 * How a business comes to belong to an organization's directory, and
 * how it leaves. Association only — the business's owner, staff,
 * services, bookings, customers, money and subscription are never
 * touched by anything here; removal just stops it appearing.
 *
 * Two directions, decided by the other side:
 *   organization → INVITED  → business owner accepts or declines
 *   business     → REQUESTED → organization approves or rejects
 * Either side can end an APPROVED association (remove / leave).
 *
 * Every transition is conditional on the state it leaves, so two
 * people deciding at once cannot both win, and everything is audited.
 */

export type AssociationError =
  | "org-not-found"
  | "org-not-accepting"
  | "business-not-found"
  | "branch-not-yours"
  | "already-linked"
  | "overlaps-existing"
  | "not-found"
  | "invalid-transition"
  | "invite-not-found"
  | "invite-expired";

export class AssociationFailure extends Error {
  constructor(readonly code: AssociationError) {
    super(code);
  }
}

export const ASSOCIATION_MESSAGES: Record<AssociationError, { status: number; ar: string }> = {
  "org-not-found": { status: 404, ar: "الجهة دي مش موجودة" },
  "org-not-accepting": { status: 409, ar: "الجهة دي مش بتقبل انضمام دلوقتي" },
  "business-not-found": { status: 404, ar: "مفيش نشاط بالرابط ده" },
  "branch-not-yours": { status: 404, ar: "الفرع ده مش تبع النشاط" },
  "already-linked": { status: 409, ar: "في ارتباط قايم بالفعل بين النشاط والجهة دي" },
  "overlaps-existing": { status: 409, ar: "النشاط كله أو فرع منه مرتبط بالفعل بالجهة دي" },
  "not-found": { status: 404, ar: "الطلب ده مش موجود" },
  "invalid-transition": { status: 409, ar: "الحالة اتغيرت بالفعل — حدّث الصفحة" },
  "invite-not-found": { status: 404, ar: "الدعوة دي مش موجودة أو اتلغت" },
  "invite-expired": { status: 410, ar: "الدعوة دي انتهت صلاحيتها" },
};

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

async function audit(actorId: string, actorRole: string, action: string, organizationId: string, summary: string, metadata: Record<string, unknown>) {
  try {
    await db.auditLog.create({
      data: { actorId, actorName: null, actorRole, action, resourceType: "Organization", resourceId: organizationId, summary, metadata: metadata as object },
    });
  } catch (e) {
    log.error("[org audit] FAILED TO RECORD", e, { action, organizationId });
  }
}

/** Whole-business and branch rows must not both be live for one organization. */
/**
 * Creates a live association after the overlap check, both under a
 * transaction-scoped advisory lock on (organization, business). The
 * whole-business-vs-branch rule spans rows the unique index cannot
 * compare, so check-then-insert must serialize: two concurrent attempts
 * queue on the lock and the second sees the first's row. An identical
 * triple still lands on `OrganizationBusiness_live_key` → already-linked.
 */
async function createAssociation(data: {
  organizationId: string;
  businessId: string;
  branchId: string | null;
  relation?: OrganizationBusinessRelation;
  status: "INVITED" | "REQUESTED";
  initiatedById: string;
  note?: string | null;
}) {
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${data.organizationId}|${data.businessId}`}))`;
      const overlapping = await tx.organizationBusiness.count({
        where: {
          organizationId: data.organizationId,
          businessId: data.businessId,
          status: { in: ["INVITED", "REQUESTED", "APPROVED"] },
          ...(data.branchId ? { branchId: null } : { branchId: { not: null } }),
        },
      });
      if (overlapping) throw new AssociationFailure("overlaps-existing");
      return tx.organizationBusiness.create({ data, select: { id: true, status: true } });
    });
  } catch (e) {
    if (isUnique(e)) throw new AssociationFailure("already-linked");
    throw e;
  }
}

/* ─── Organization side ───────────────────────────────────── */

/**
 * Only a reviewed organization can collect businesses — recruiting or
 * being joined before review would lend it standing nobody checked.
 */
async function requireAccepting(organizationId: string): Promise<void> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { status: true } });
  if (!org) throw new AssociationFailure("org-not-found");
  if (org.status !== "APPROVED") throw new AssociationFailure("org-not-accepting");
}

export async function inviteBusiness(input: {
  organizationId: string;
  byUserId: string;
  authority: string;
  businessSlug: string;
  branchId: string | null;
  relation: OrganizationBusinessRelation;
  note: string | null;
}) {
  // Recruiting starts after the platform's review, like requests do.
  await requireAccepting(input.organizationId);
  const business = await db.business.findUnique({ where: { slug: input.businessSlug }, select: { id: true, nameAr: true } });
  if (!business) throw new AssociationFailure("business-not-found");
  if (input.branchId) {
    const branch = await db.branch.findFirst({ where: { id: input.branchId, businessId: business.id, isActive: true }, select: { id: true } });
    if (!branch) throw new AssociationFailure("branch-not-yours");
  }
  const row = await createAssociation({
    organizationId: input.organizationId,
    businessId: business.id,
    branchId: input.branchId,
    relation: input.relation,
    status: "INVITED",
    initiatedById: input.byUserId,
    note: input.note,
  });
  await audit(input.byUserId, input.authority, "org.business.invite", input.organizationId, `دعا "${business.nameAr}" للانضمام`, { associationId: row.id, businessId: business.id, branchId: input.branchId });
  return row;
}

export type OrgDecision = "approve" | "reject" | "remove" | "organize";

const ORG_FROM: Record<Exclude<OrgDecision, "organize">, ("INVITED" | "REQUESTED" | "APPROVED")[]> = {
  approve: ["REQUESTED"],
  reject: ["REQUESTED"],
  remove: ["APPROVED", "INVITED"],
};
const ORG_TO = { approve: "APPROVED", reject: "REJECTED", remove: "REMOVED" } as const;

export async function decideAssociation(input: {
  organizationId: string;
  associationId: string;
  byUserId: string;
  authority: string;
  action: OrgDecision;
  section?: string | null;
  sortOrder?: number;
  relation?: OrganizationBusinessRelation;
  note?: string | null;
}) {
  const existing = await db.organizationBusiness.findFirst({
    where: { id: input.associationId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!existing) throw new AssociationFailure("not-found");

  const organize = {
    ...(input.section !== undefined ? { section: input.section } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.relation !== undefined ? { relation: input.relation } : {}),
  };
  const data =
    input.action === "organize"
      ? organize
      : { ...organize, status: ORG_TO[input.action], decidedById: input.byUserId, decidedAt: new Date(), note: input.note ?? undefined };
  const { count } = await db.organizationBusiness.updateMany({
    where: {
      id: input.associationId,
      organizationId: input.organizationId,
      ...(input.action === "organize" ? { status: { in: ["INVITED", "REQUESTED", "APPROVED"] } } : { status: { in: ORG_FROM[input.action] } }),
    },
    data,
  });
  if (count === 0) throw new AssociationFailure("invalid-transition");
  await audit(input.byUserId, input.authority, `org.business.${input.action}`, input.organizationId, `قرار على ارتباط نشاط: ${input.action}`, { associationId: input.associationId });
}

/* ─── Business side ───────────────────────────────────────── */

export async function requestToJoin(input: {
  businessId: string;
  userId: string;
  organizationId: string;
  branchId: string | null;
}) {
  await requireAccepting(input.organizationId);
  if (input.branchId) {
    const branch = await db.branch.findFirst({ where: { id: input.branchId, businessId: input.businessId, isActive: true }, select: { id: true } });
    if (!branch) throw new AssociationFailure("branch-not-yours");
  }
  const row = await createAssociation({
    organizationId: input.organizationId,
    businessId: input.businessId,
    branchId: input.branchId,
    status: "REQUESTED",
    initiatedById: input.userId,
  });
  await audit(input.userId, "BUSINESS_OWNER", "org.business.request", input.organizationId, "صاحب نشاط طلب الانضمام", { associationId: row.id, businessId: input.businessId, branchId: input.branchId });
  return row;
}

/** The business owner answers an invitation, or leaves. */
export async function respondAsBusiness(input: {
  businessId: string;
  userId: string;
  associationId: string;
  action: "accept" | "decline" | "leave";
}) {
  const row = await db.organizationBusiness.findFirst({
    where: { id: input.associationId, businessId: input.businessId },
    select: { organizationId: true },
  });
  if (!row) throw new AssociationFailure("not-found");
  // Accepting re-checks the organization's standing: an invitation sent
  // before a suspension must not keep collecting businesses after it.
  if (input.action === "accept") await requireAccepting(row.organizationId);
  const from = input.action === "accept" || input.action === "decline" ? ["INVITED" as const] : ["APPROVED" as const, "REQUESTED" as const];
  const to = input.action === "accept" ? "APPROVED" : input.action === "decline" ? "DECLINED" : "REMOVED";
  const { count } = await db.organizationBusiness.updateMany({
    where: { id: input.associationId, businessId: input.businessId, status: { in: from } },
    data: { status: to, decidedById: input.userId, decidedAt: new Date() },
  });
  if (count === 0) throw new AssociationFailure("invalid-transition");
  await audit(input.userId, "BUSINESS_OWNER", `org.business.${input.action}`, row.organizationId, `صاحب النشاط ${input.action === "accept" ? "قبل الدعوة" : input.action === "decline" ? "رفض الدعوة" : "خرج من الجهة"}`, { associationId: input.associationId, businessId: input.businessId });
}

/* ─── Email invitations: create a NEW business under the organization ─ */

export async function createEmailInvite(input: {
  organizationId: string;
  byUserId: string;
  authority: string;
  email: string;
  relation: OrganizationBusinessRelation;
}) {
  await requireAccepting(input.organizationId);
  const invite = await db.organizationInvite.create({
    data: {
      organizationId: input.organizationId,
      email: input.email,
      relation: input.relation,
      token: randomToken(24),
      invitedById: input.byUserId,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    },
    select: { id: true, token: true, expiresAt: true },
  });
  await audit(input.byUserId, input.authority, "org.invite.create", input.organizationId, `دعوة بالإيميل لإنشاء نشاط`, { inviteId: invite.id });
  return invite;
}

/** What an invite link shows before onboarding. Token only; no session. */
export async function readInvite(token: string) {
  const invite = await db.organizationInvite.findUnique({
    where: { token },
    select: {
      id: true, relation: true, expiresAt: true, cancelledAt: true, acceptedBusinessId: true,
      organization: { select: { id: true, slug: true, nameAr: true, nameEn: true, logoImage: true } },
    },
  });
  if (!invite || invite.cancelledAt || invite.acceptedBusinessId) throw new AssociationFailure("invite-not-found");
  if (invite.expiresAt < new Date()) throw new AssociationFailure("invite-expired");
  // A suspended or rejected organization's links go dark with the page.
  await requireAccepting(invite.organization.id);
  return invite;
}

/**
 * Called inside the onboarding transaction when a business is created
 * with an invite token: claims the invite and links the new business,
 * APPROVED from the start. Best-effort never: a bad token fails the
 * claim loudly so onboarding can tell the owner.
 */
export async function acceptEmailInvite(
  tx: Prisma.TransactionClient,
  token: string,
  businessId: string,
  userId: string,
): Promise<{ organizationId: string }> {
  const invite = await tx.organizationInvite.findUnique({
    where: { token },
    select: { id: true, organizationId: true, relation: true, expiresAt: true, cancelledAt: true, acceptedBusinessId: true, invitedById: true },
  });
  if (!invite || invite.cancelledAt || invite.acceptedBusinessId) throw new AssociationFailure("invite-not-found");
  if (invite.expiresAt < new Date()) throw new AssociationFailure("invite-expired");
  // Re-checked at claim time: suspension between sending and accepting
  // must stop the join (and roll the whole onboarding back with it).
  const org = await tx.organization.findUnique({ where: { id: invite.organizationId }, select: { status: true } });
  if (org?.status !== "APPROVED") throw new AssociationFailure("org-not-accepting");
  const claimed = await tx.organizationInvite.updateMany({
    where: { id: invite.id, acceptedBusinessId: null, cancelledAt: null },
    data: { acceptedBusinessId: businessId },
  });
  if (claimed.count === 0) throw new AssociationFailure("invite-not-found");
  await tx.organizationBusiness.create({
    data: {
      organizationId: invite.organizationId,
      businessId,
      relation: invite.relation,
      status: "APPROVED",
      initiatedById: invite.invitedById,
      decidedById: userId,
      decidedAt: new Date(),
    },
  });
  return { organizationId: invite.organizationId };
}

/* ─── Listings ────────────────────────────────────────────── */

/** Organization side: what the business is — never who its customers are. */
export async function listAssociations(organizationId: string) {
  const rows = await db.organizationBusiness.findMany({
    where: { organizationId },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, status: true, relation: true, section: true, sortOrder: true, note: true, createdAt: true, decidedAt: true,
      branch: { select: { id: true, nameAr: true, nameEn: true } },
      business: {
        select: {
          id: true, slug: true, nameAr: true, nameEn: true, isPublished: true, logoImage: true,
          category: { select: { nameAr: true, nameEn: true } },
          city: { select: { nameAr: true, nameEn: true } },
        },
      },
    },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null }));
}
