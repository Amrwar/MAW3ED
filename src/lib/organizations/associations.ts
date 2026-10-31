import type { DelegationScope, OrganizationBusinessRelation } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { randomToken } from "@/lib/tokens";
import { ASSOCIATIONS_PAGE_SIZE, INVITE_DAYS } from "./rules";
import { RELATIONSHIPS, checkScopes, type Relationship } from "./delegation";

/**
 * How a business comes to belong to an organization's directory, and
 * how it leaves. Association only — the business's owner, staff,
 * services, bookings, customers, money and subscription are never
 * touched by anything here; removal just stops it appearing.
 *
 * Two directions, decided by the other side:
 *   organization → INVITED  → business owner accepts or declines
 *   business     → REQUESTED → organization approves or rejects
 * Either side can pause an APPROVED association (SUSPENDED: unlisted,
 * no delegated access) and only the side that paused it can resume it.
 * Either side can end it (remove / leave).
 *
 * Each row is one relationship type — OWNED, HOSTED or MANAGED
 * (lib/organizations/delegation.ts) — fixed when the row is created: a
 * different relationship is a new row the business approves, never a
 * relabelling. Operational access (scopes) is granted by the business
 * alone, on OWNED and MANAGED rows only; the organization can ask, never
 * grant itself. A business has at most one owning organization.
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
  | "invite-expired"
  | "already-owned"
  | "relation-not-allowed"
  | "scopes-not-allowed"
  | "not-yours-to-resume"
  | "hierarchy-invalid";

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
  "already-owned": { status: 409, ar: "النشاط ده مملوك لجهة تانية بالفعل — النشاط له جهة مالكة واحدة بس" },
  "relation-not-allowed": { status: 422, ar: "نوع العلاقة لازم يكون: مملوك، مستضاف، أو مُدار" },
  "scopes-not-allowed": { status: 422, ar: "الصلاحيات دي مش مسموحة للنوع ده من العلاقة" },
  "not-yours-to-resume": { status: 403, ar: "الطرف اللي أوقف العلاقة هو بس اللي يقدر يرجّعها" },
  "hierarchy-invalid": { status: 409, ar: "الترتيب ده مش ممكن: هيعمل دايرة أو أعمق من 3 مستويات" },
};

const LIVE = ["INVITED", "REQUESTED", "APPROVED", "SUSPENDED"] as const;

function requireRelationship(relation: string): Relationship {
  if (!RELATIONSHIPS.includes(relation as Relationship)) throw new AssociationFailure("relation-not-allowed");
  return relation as Relationship;
}

function requireScopes(relation: OrganizationBusinessRelation, branchId: string | null, scopes: readonly string[]): DelegationScope[] {
  const checked = checkScopes(relation, branchId, scopes);
  if (!checked.ok) throw new AssociationFailure("scopes-not-allowed");
  return checked.scopes;
}

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

/**
 * Creates a live association after its two cross-row checks, both under a
 * transaction-scoped advisory lock on the business:
 *
 *  - whole-business and branch rows of one relationship type must not
 *    both be live for one organization;
 *  - a business has at most one owning organization.
 *
 * Both span rows a unique index cannot compare in the friendly way, so
 * check-then-insert must serialize; the database indexes
 * (`OrganizationBusiness_live_rel_key`, `_one_owner_key`) stay the
 * backstop.
 */
async function createAssociation(data: {
  organizationId: string;
  businessId: string;
  branchId: string | null;
  relation: Relationship;
  status: "INVITED" | "REQUESTED";
  initiatedById: string;
  note?: string | null;
  requestedScopes?: DelegationScope[];
  scopes?: DelegationScope[];
  expiresAt?: Date | null;
}) {
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`org-business|${data.businessId}`}))`;
      if (data.relation === "OWNED") {
        const owned = await tx.organizationBusiness.findFirst({
          where: { businessId: data.businessId, relation: "OWNED", status: { in: [...LIVE] } },
          select: { organizationId: true },
        });
        if (owned) throw new AssociationFailure(owned.organizationId === data.organizationId ? "already-linked" : "already-owned");
      }
      const overlapping = await tx.organizationBusiness.count({
        where: {
          organizationId: data.organizationId,
          businessId: data.businessId,
          relation: data.relation,
          status: { in: [...LIVE] },
          ...(data.branchId ? { branchId: null } : { branchId: { not: null } }),
        },
      });
      if (overlapping) throw new AssociationFailure("overlaps-existing");
      return tx.organizationBusiness.create({ data, select: { id: true, status: true, relation: true } });
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
  /** What the organization asks to operate (OWNED/MANAGED); the business decides. */
  requestedScopes?: readonly string[];
}) {
  const relation = requireRelationship(input.relation);
  const requestedScopes = requireScopes(relation, input.branchId, input.requestedScopes ?? []);
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
    relation,
    status: "INVITED",
    initiatedById: input.byUserId,
    note: input.note,
    requestedScopes,
  });
  await audit(input.byUserId, input.authority, "org.business.invite", input.organizationId, `دعا "${business.nameAr}" (${relation})`, { associationId: row.id, businessId: business.id, branchId: input.branchId, relation, requestedScopes });
  return row;
}

export type OrgDecision = "approve" | "reject" | "remove" | "organize" | "suspend" | "resume";

const ORG_FROM: Record<Exclude<OrgDecision, "organize">, (typeof LIVE)[number][]> = {
  approve: ["REQUESTED"],
  reject: ["REQUESTED"],
  remove: ["APPROVED", "INVITED", "SUSPENDED"],
  suspend: ["APPROVED"],
  resume: ["SUSPENDED"],
};
const ORG_TO = { approve: "APPROVED", reject: "REJECTED", remove: "REMOVED", suspend: "SUSPENDED", resume: "APPROVED" } as const;

/**
 * Who paused a suspended row: the business (its owner) or the
 * organization. Only that side may resume — otherwise an organization
 * could undo a business's pause on its own delegated access.
 */
async function suspendedByBusiness(associationId: string): Promise<boolean> {
  const row = await db.organizationBusiness.findUnique({
    where: { id: associationId },
    select: { suspendedById: true, business: { select: { ownerId: true } } },
  });
  return !!row?.suspendedById && row.suspendedById === row.business.ownerId;
}

export async function decideAssociation(input: {
  organizationId: string;
  associationId: string;
  byUserId: string;
  authority: string;
  action: OrgDecision;
  section?: string | null;
  sortOrder?: number;
  note?: string | null;
}) {
  const existing = await db.organizationBusiness.findFirst({
    where: { id: input.associationId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!existing) throw new AssociationFailure("not-found");
  if (input.action === "resume" && (await suspendedByBusiness(input.associationId))) {
    throw new AssociationFailure("not-yours-to-resume");
  }

  // Directory placement only. The relationship type is fixed at creation
  // and scopes are the business's to grant: neither is editable here.
  const organize = {
    ...(input.section !== undefined ? { section: input.section } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };
  const transition =
    input.action === "organize"
      ? {}
      : input.action === "suspend"
        ? { status: "SUSPENDED" as const, suspendedAt: new Date(), suspendedById: input.byUserId }
        : input.action === "resume"
          ? { status: "APPROVED" as const, suspendedAt: null, suspendedById: null }
          : { status: ORG_TO[input.action], decidedById: input.byUserId, decidedAt: new Date(), note: input.note ?? undefined };
  const { count } = await db.organizationBusiness.updateMany({
    where: {
      id: input.associationId,
      organizationId: input.organizationId,
      ...(input.action === "organize" ? { status: { in: [...LIVE] } } : { status: { in: ORG_FROM[input.action] } }),
    },
    data: { ...organize, ...transition },
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
  /** HOSTED when absent: being listed is the common case. */
  relation?: OrganizationBusinessRelation;
  /** Granted by the business with the request (OWNED/MANAGED only). */
  scopes?: readonly string[];
  expiresAt?: Date | null;
}) {
  const relation = requireRelationship(input.relation ?? "HOSTED");
  const scopes = requireScopes(relation, input.branchId, input.scopes ?? []);
  await requireAccepting(input.organizationId);
  if (input.branchId) {
    const branch = await db.branch.findFirst({ where: { id: input.branchId, businessId: input.businessId, isActive: true }, select: { id: true } });
    if (!branch) throw new AssociationFailure("branch-not-yours");
  }
  const row = await createAssociation({
    organizationId: input.organizationId,
    businessId: input.businessId,
    branchId: input.branchId,
    relation,
    status: "REQUESTED",
    initiatedById: input.userId,
    scopes,
    requestedScopes: scopes,
    expiresAt: scopes.length ? (input.expiresAt ?? null) : null,
  });
  await audit(input.userId, "BUSINESS_OWNER", "org.business.request", input.organizationId, `صاحب نشاط طلب الانضمام (${relation})`, { associationId: row.id, businessId: input.businessId, branchId: input.branchId, relation, scopes });
  return row;
}

export type BusinessResponse = "accept" | "decline" | "leave" | "suspend" | "resume" | "grant";

const BUSINESS_FROM: Record<BusinessResponse, (typeof LIVE)[number][]> = {
  accept: ["INVITED"],
  decline: ["INVITED"],
  leave: ["APPROVED", "REQUESTED", "SUSPENDED"],
  suspend: ["APPROVED"],
  resume: ["SUSPENDED"],
  grant: ["APPROVED", "SUSPENDED", "REQUESTED"],
};

const BUSINESS_SUMMARY: Record<BusinessResponse, string> = {
  accept: "صاحب النشاط قبل الدعوة",
  decline: "صاحب النشاط رفض الدعوة",
  leave: "صاحب النشاط خرج من الجهة",
  suspend: "صاحب النشاط أوقف العلاقة مؤقتًا",
  resume: "صاحب النشاط رجّع العلاقة",
  grant: "صاحب النشاط غيّر صلاحيات الجهة",
};

/**
 * The business owner answers an invitation, leaves, pauses or resumes,
 * or changes what the organization may operate (`grant`: an empty list
 * revokes everything at once; access is re-read on every request).
 */
export async function respondAsBusiness(input: {
  businessId: string;
  userId: string;
  associationId: string;
  action: BusinessResponse;
  /** accept / grant: what to grant. On accept, defaults to what was asked. */
  scopes?: readonly string[];
  /** accept / grant: when the grant ends; null for until revoked. */
  expiresAt?: Date | null;
}) {
  const row = await db.organizationBusiness.findFirst({
    where: { id: input.associationId, businessId: input.businessId },
    select: { organizationId: true, relation: true, branchId: true, requestedScopes: true, suspendedById: true },
  });
  if (!row) throw new AssociationFailure("not-found");
  // Accepting re-checks the organization's standing: an invitation sent
  // before a suspension must not keep collecting businesses after it.
  if (input.action === "accept") await requireAccepting(row.organizationId);
  if (input.action === "resume" && row.suspendedById !== input.userId && !(await suspendedByBusiness(input.associationId))) {
    throw new AssociationFailure("not-yours-to-resume");
  }

  const grants = input.action === "accept" || input.action === "grant";
  const scopes = grants ? requireScopes(row.relation, row.branchId, input.scopes ?? (input.action === "accept" ? row.requestedScopes : [])) : null;
  const data =
    input.action === "accept"
      ? { status: "APPROVED" as const, decidedById: input.userId, decidedAt: new Date(), scopes: scopes!, expiresAt: scopes!.length ? (input.expiresAt ?? null) : null }
      : input.action === "decline"
        ? { status: "DECLINED" as const, decidedById: input.userId, decidedAt: new Date() }
        : input.action === "leave"
          ? { status: "REMOVED" as const, decidedById: input.userId, decidedAt: new Date(), scopes: [] }
          : input.action === "suspend"
            ? { status: "SUSPENDED" as const, suspendedAt: new Date(), suspendedById: input.userId }
            : input.action === "resume"
              ? { status: "APPROVED" as const, suspendedAt: null, suspendedById: null }
              : { scopes: scopes!, expiresAt: scopes!.length ? (input.expiresAt ?? null) : null };
  const { count } = await db.organizationBusiness.updateMany({
    where: { id: input.associationId, businessId: input.businessId, status: { in: BUSINESS_FROM[input.action] } },
    data,
  });
  if (count === 0) throw new AssociationFailure("invalid-transition");
  await audit(input.userId, "BUSINESS_OWNER", `org.business.${input.action}`, row.organizationId, BUSINESS_SUMMARY[input.action], {
    associationId: input.associationId,
    businessId: input.businessId,
    ...(scopes ? { scopes, expiresAt: input.expiresAt ?? null } : {}),
  });
}

/* ─── Email invitations: create a NEW business under the organization ─ */

export async function createEmailInvite(input: {
  organizationId: string;
  byUserId: string;
  authority: string;
  email: string;
  relation: OrganizationBusinessRelation;
  requestedScopes?: readonly string[];
}) {
  const relation = requireRelationship(input.relation);
  const requestedScopes = requireScopes(relation, null, input.requestedScopes ?? []);
  await requireAccepting(input.organizationId);
  const invite = await db.organizationInvite.create({
    data: {
      organizationId: input.organizationId,
      email: input.email,
      relation,
      requestedScopes,
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
      id: true, relation: true, requestedScopes: true, expiresAt: true, cancelledAt: true, acceptedBusinessId: true,
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
    select: { id: true, organizationId: true, relation: true, requestedScopes: true, expiresAt: true, cancelledAt: true, acceptedBusinessId: true, invitedById: true },
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
  // Creating the business under this invitation, after being shown what
  // it asks to operate, is the new owner's consent to exactly that.
  const relation = requireRelationship(invite.relation);
  const scopes = requireScopes(relation, null, invite.requestedScopes);
  await tx.organizationBusiness.create({
    data: {
      organizationId: invite.organizationId,
      businessId,
      relation,
      scopes,
      requestedScopes: scopes,
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
/**
 * Paged: an organization with hundreds of businesses loads one page of
 * its console at a time, never the whole list.
 */
export async function listAssociations(organizationId: string, page = 1) {
  const where = { organizationId };
  const total = await db.organizationBusiness.count({ where });
  const pages = Math.max(1, Math.ceil(total / ASSOCIATIONS_PAGE_SIZE));
  const current = Math.min(Math.max(Math.floor(Number.isFinite(page) ? page : 1), 1), pages);
  const rows = await db.organizationBusiness.findMany({
    where,
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    skip: (current - 1) * ASSOCIATIONS_PAGE_SIZE,
    take: ASSOCIATIONS_PAGE_SIZE,
    select: {
      id: true, status: true, relation: true, section: true, sortOrder: true, note: true, createdAt: true, decidedAt: true,
      requestedScopes: true, scopes: true, expiresAt: true, suspendedAt: true,
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
  return {
    associations: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      suspendedAt: r.suspendedAt?.toISOString() ?? null,
    })),
    total,
    page: current,
    pages,
  };
}

/* ─── Organization hierarchy ──────────────────────────────── */

/**
 * Puts an organization under a parent (a holding company over a mall),
 * or takes it out. Linking needs ownership of BOTH organizations — or the
 * platform — so nobody can claim someone else's company as a subsidiary,
 * or adopt one. Unlinking needs ownership of either.
 *
 * Cycles and depth beyond three levels are refused by a database trigger
 * (phase22c_relationships.sql), which also serializes concurrent changes;
 * this only turns its refusal into a sentence.
 */
export async function setParentOrganization(input: {
  childId: string;
  parentId: string | null;
  byUserId: string;
  /** The caller's authority over the child and (when linking) the parent. */
  childAuthority: string | null;
  parentAuthority: string | null;
}) {
  const owns = (a: string | null) => a === "OWNER" || a === "PLATFORM";
  const child = await db.organization.findUnique({ where: { id: input.childId }, select: { parentId: true, status: true } });
  if (!child) throw new AssociationFailure("org-not-found");
  if (input.parentId) {
    if (!owns(input.childAuthority) || !owns(input.parentAuthority)) throw new AssociationFailure("not-found");
    const parent = await db.organization.findUnique({ where: { id: input.parentId }, select: { status: true } });
    if (!parent) throw new AssociationFailure("org-not-found");
    if (parent.status !== "APPROVED" || child.status !== "APPROVED") throw new AssociationFailure("org-not-accepting");
  } else if (!owns(input.childAuthority) && !owns(input.parentAuthority)) {
    throw new AssociationFailure("not-found");
  }
  try {
    await db.organization.update({ where: { id: input.childId }, data: { parentId: input.parentId } });
  } catch (e) {
    if (e instanceof Error && /organization hierarchy|not_own_parent/.test(e.message)) throw new AssociationFailure("hierarchy-invalid");
    throw e;
  }
  const summary = input.parentId ? "ربط الجهة تحت جهة أم" : "فك ارتباط الجهة بالجهة الأم";
  for (const orgId of [input.childId, input.parentId ?? child.parentId].filter((x): x is string => !!x)) {
    await audit(input.byUserId, input.childAuthority ?? "OWNER", "org.parent.set", orgId, summary, {
      childId: input.childId,
      from: child.parentId,
      to: input.parentId,
    });
  }
}
