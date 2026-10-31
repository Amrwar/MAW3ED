import type { Business, StaffAccess } from "@prisma/client";
import { db } from "@/lib/db";
import { err, requireSession } from "@/lib/api";
import { readActingBusinessId, resolveDelegation, type Delegation } from "@/lib/organizations/delegation";

/**
 * Who is acting for a business, and what they may do.
 *
 * Three kinds of people work a business in the app:
 *
 *  - the OWNER — Business.ownerId — everything;
 *  - a MANAGER — a staff member the owner gave manager access — every
 *    booking and customer, and the day's actions on them;
 *  - a PROVIDER — a staff member with provider access — the bookings
 *    with them, and moving those through the day;
 *  - a DELEGATE — a member of an organization that owns or manages the
 *    business, operating it within the scopes the business granted
 *    (lib/organizations/delegation.ts). Never the owner's other powers:
 *    billing, publishing, who may sign in, settings outside the scopes.
 *
 * Everything is read from the database on every request. Nothing about
 * the business comes from the caller: not a businessId in the token
 * (a snapshot from sign-in that can stop being true), not one in the
 * URL. A business is found from the signed-in account alone, so there
 * is no input that could name somebody else's. Taking a staff member's
 * access away ends it on their next request.
 */

export type BusinessRole = "OWNER" | StaffAccess | "DELEGATE";

export interface BusinessActor {
  role: BusinessRole;
  userId: string;
  /** The staff member this person is, for a manager or provider. */
  staffMemberId: string | null;
  /** For a DELEGATE: what the organizations' grants add up to. */
  delegation?: Delegation;
}

export type BusinessAction =
  /** Read bookings: all of them, or (provider) only their own. */
  | "bookings.read"
  /** Every booking of the business, not just one's own. */
  | "bookings.readAll"
  /** Confirm a pending booking. */
  | "bookings.confirm"
  /** Arrived, in progress, completed, no-show. */
  | "bookings.progress"
  | "bookings.cancel"
  | "bookings.reschedule"
  /** The customer book: list, search, a customer's history. */
  | "customers.read"
  | "staff.read"
  | "staff.manageAccess"
  | "services.read"
  | "profile.read"
  | "reports.read"
  /** Add a booking by hand (phone, walk-in). */
  | "bookings.create"
  /** Notes and details on a customer. */
  | "customers.manage"
  | "services.manage"
  /** Staff records — not who may sign in, which is staff.manageAccess. */
  | "staff.manage"
  /** Opening hours, staff hours, time blocks. */
  | "schedule.read"
  | "schedule.manage"
  | "profile.manage"
  /** Revenue and money figures. */
  | "finance.read";

const RULES: Record<BusinessAction, readonly BusinessRole[]> = {
  "bookings.read": ["OWNER", "MANAGER", "PROVIDER"],
  "bookings.readAll": ["OWNER", "MANAGER"],
  "bookings.confirm": ["OWNER", "MANAGER", "PROVIDER"],
  "bookings.progress": ["OWNER", "MANAGER", "PROVIDER"],
  // Cancelling or moving an appointment is the business's word to a
  // customer; a provider's own diary is not theirs to rearrange.
  "bookings.cancel": ["OWNER", "MANAGER"],
  "bookings.reschedule": ["OWNER", "MANAGER"],
  "customers.read": ["OWNER", "MANAGER"],
  "staff.read": ["OWNER", "MANAGER", "PROVIDER"],
  // Who may sign in as the business is the owner's alone.
  "staff.manageAccess": ["OWNER"],
  "services.read": ["OWNER", "MANAGER", "PROVIDER"],
  "profile.read": ["OWNER", "MANAGER", "PROVIDER"],
  // Revenue and figures stay with the owner.
  "reports.read": ["OWNER"],
  // Before delegation these were simply "the owner's routes"; they stay
  // the owner's for staff. A DELEGATE gets them only through a scope.
  "bookings.create": ["OWNER"],
  "customers.manage": ["OWNER"],
  "services.manage": ["OWNER"],
  "staff.manage": ["OWNER"],
  "schedule.read": ["OWNER"],
  "schedule.manage": ["OWNER"],
  "profile.manage": ["OWNER"],
  "finance.read": ["OWNER"],
};

type Actor = Pick<BusinessActor, "role"> & { delegation?: Pick<Delegation, "actions"> };

export function can(actor: Actor, action: BusinessAction): boolean {
  // A delegate's powers are exactly the granted scopes, never a role's.
  if (actor.role === "DELEGATE") return actor.delegation?.actions.includes(action) ?? false;
  return RULES[action].includes(actor.role);
}

/** Every action this actor may take — what the app shows or hides. */
export function permissionsOf(actor: Actor): BusinessAction[] {
  return (Object.keys(RULES) as BusinessAction[]).filter((a) => can(actor, a));
}

/**
 * The business the signed-in account works for, and as whom; null when
 * it works for none.
 *
 * An owner is an owner first: an account that owns a business is not
 * also somebody else's staff. A staff member whose phone the owner set
 * but who has not signed in yet is linked here, the first time that
 * phone — verified, by a one-time code — signs in.
 */
export async function resolveBusinessAccess(userId: string): Promise<{ business: Business; actor: BusinessActor } | null> {
  // Operating a business for an organization comes first while chosen:
  // the person asked to act there. An acting cookie that no longer
  // grants anything (scopes cleared, relationship suspended, membership
  // ended) is ignored, and the account falls back to its own place.
  const acting = await actingAccess(userId);
  if (acting) return acting;

  const owned = await db.business.findUnique({ where: { ownerId: userId } });
  if (owned) return { business: owned, actor: { role: "OWNER", userId, staffMemberId: null } };

  let staff = await db.staffMember.findUnique({ where: { userId }, include: { business: true } });

  if (!staff) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
    // Only a verified number can claim a staff place: an unverified one
    // is just something somebody typed.
    if (user?.phone && user.phoneVerifiedAt) {
      const waiting = await db.staffMember.findUnique({ where: { loginPhone: user.phone }, include: { business: true } });
      if (waiting && !waiting.userId && waiting.access) {
        // Conditional on still being unclaimed, so two sign-ins racing
        // for the same place cannot both take it.
        // The phone and access are checked again in the write: if the
        // owner changed the number since the read, this person no longer
        // matches and must not take the place meant for the new one.
        const claimed = await db.staffMember.updateMany({
          where: { id: waiting.id, userId: null, loginPhone: user.phone, access: { not: null } },
          data: { userId },
        });
        if (claimed.count === 1) staff = { ...waiting, userId };
      }
    }
  }

  if (!staff || !staff.isActive || !staff.access || staff.userId !== userId) return null;
  return { business: staff.business, actor: { role: staff.access, userId, staffMemberId: staff.id } };
}

/**
 * The delegated access the request's acting cookie stands for, or null:
 * no cookie, or one that no longer grants anything.
 */
export async function actingAccess(userId: string): Promise<{ business: Business; actor: BusinessActor } | null> {
  const businessId = await readActingBusinessId();
  if (!businessId) return null;
  const delegation = await resolveDelegation(userId, businessId);
  if (!delegation) return null;
  const business = await db.business.findUnique({ where: { id: businessId } });
  if (!business) return null;
  return { business, actor: { role: "DELEGATE", userId, staffMemberId: null, delegation } };
}

/**
 * The guard for business routes that staff may use. Throws a 404 when
 * the account works for no business — the same answer requireBusiness
 * gives, which does not confirm that anything exists — and a 403 when
 * it does but may not take `action`.
 */
export async function requireBusinessAccess(action: BusinessAction) {
  const session = await requireSession();
  const access = await resolveBusinessAccess(session.user.id);
  if (!access) throw err("لم يتم العثور على عملك", 404);
  if (!can(access.actor, action)) throw err("مش مسموح لك بالإجراء ده", 403, { code: "forbidden" });
  return { session, ...access };
}

/** As requireBusinessAccess, passing when the actor may take any one of `actions`. */
export async function requireBusinessAccessAny(actions: readonly BusinessAction[]) {
  const session = await requireSession();
  const access = await resolveBusinessAccess(session.user.id);
  if (!access) throw err("لم يتم العثور على عملك", 404);
  if (!actions.some((a) => can(access.actor, a))) throw err("مش مسموح لك بالإجراء ده", 403, { code: "forbidden" });
  return { session, ...access };
}

/**
 * The bookings this actor may see, as a where-clause fragment: the whole
 * business for an owner or manager, only their own for a provider. Every
 * booking query a staff member can reach is built on this.
 */
export function bookingScope(business: Pick<Business, "id">, actor: BusinessActor) {
  // A delegate limited to some branches sees those branches' bookings.
  if (actor.role === "DELEGATE" && actor.delegation?.branchIds) {
    return { businessId: business.id, branchId: { in: actor.delegation.branchIds } };
  }
  return can(actor, "bookings.readAll")
    ? { businessId: business.id }
    : { businessId: business.id, staffMemberId: actor.staffMemberId ?? "__none__" };
}

/** What the app is told about a staff member's place, at sign-in and on every launch. */
export interface StaffSummary {
  businessId: string;
  businessName: string;
  role: StaffAccess;
  staffMemberId: string;
  permissions: BusinessAction[];
}

/**
 * The business this account is staff at, for the app's user object — null
 * for owners (who have `businessId`) and for everybody else. Linking a
 * waiting staff place happens here too, so a person whose owner just
 * added them sees the business on their first sign-in.
 */
export async function staffSummaryFor(userId: string): Promise<StaffSummary | null> {
  const access = await resolveBusinessAccess(userId);
  if (!access || access.actor.role === "OWNER" || access.actor.role === "DELEGATE" || !access.actor.staffMemberId) return null;
  return {
    businessId: access.business.id,
    businessName: access.business.nameAr,
    role: access.actor.role,
    staffMemberId: access.actor.staffMemberId,
    permissions: permissionsOf(access.actor),
  };
}
