import { can, requireBusinessAccess } from "@/lib/business-access";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * requireBusiness rather than auth() + session.user.businessId: it
 * accepts the mobile app's bearer token, which auth() alone refused,
 * and it confirms against the database that the caller still owns this
 * business instead of trusting an id inside a long-lived token.
 */

/**
 * The caller's business, or the Response explaining why there is none.
 *
 * requireBusiness throws its refusal; these handlers are small and read
 * better with an early return than with each one wrapped in a
 * try/catch that exists only to hand that Response back.
 */
async function ownedBusiness() {
  try {
    const { business, actor } = await requireBusinessAccess("staff.manage");
    return Object.assign(business, { canManageAccess: can(actor, "staff.manageAccess") });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

async function getOwned(id: string, businessId: string) {
  return db.staffMember.findFirst({ where: { id, businessId } });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ownedBusiness();
  if (guard instanceof Response) return guard;

  const { id } = await params;
  const existing = await getOwned(id, guard.id);
  if (!existing) return NextResponse.json({ error: "الموظف ده مش موجود" }, { status: 404 });

  const body = await req.json();
  const { serviceIds, ...rest } = body;

  // Service ids arrive from the client and were attached without a
  // check, so a request naming another business's service would have
  // linked it to this staff member. Narrowed to the services this
  // business actually owns; anything else is dropped rather than
  // refused, because the usual cause is a stale screen.
  let ownServiceIds: string[] | undefined;
  if (serviceIds !== undefined) {
    if (!Array.isArray(serviceIds)) {
      return NextResponse.json({ error: "اختار الخدمات من القائمة" }, { status: 422 });
    }
    const mine = await db.service.findMany({
      where: { businessId: guard.id, id: { in: serviceIds as string[] } },
      select: { id: true },
    });
    ownServiceIds = mine.map((x) => x.id);
  }

  // Deactivating someone who signs in ends their access: that is the
  // owner's power over sign-in (staff.manageAccess), not a staff edit.
  if (!guard.canManageAccess && rest.isActive != null && rest.isActive !== existing.isActive && (existing.userId || existing.access)) {
    return NextResponse.json({ error: "تفعيل وإيقاف حساب دخول الموظف لصاحب النشاط بس", code: "forbidden" }, { status: 403 });
  }

  const member = await db.staffMember.update({
    where: { id },
    data: {
      nameAr:      rest.nameAr?.trim()     ?? existing.nameAr,
      nameEn:      "nameEn"      in rest ? (rest.nameEn?.trim() || null)  : existing.nameEn,
      role:        "role"        in rest ? (rest.role?.trim()   || null)  : existing.role,
      photo:       "photo"       in rest ? (rest.photo?.trim()  || null)  : existing.photo,
      isActive:    rest.isActive  != null  ? rest.isActive                : existing.isActive,
      workingDays: rest.workingDays != null ? rest.workingDays            : existing.workingDays,
      specialties: rest.specialties != null ? rest.specialties            : existing.specialties,
      ...(ownServiceIds !== undefined && {
        services: {
          deleteMany: {},
          create: ownServiceIds.map((sid) => ({ serviceId: sid })),
        },
      }),
    },
    include: { services: { include: { service: { select: { id: true, nameAr: true } } } } },
  });

  // Who signs in, and with which number, is the owner's to see.
  const { loginPhone, userId, ...visible } = member;
  return NextResponse.json(guard.canManageAccess ? { ...visible, loginPhone, linked: Boolean(userId) } : visible);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ownedBusiness();
  if (guard instanceof Response) return guard;

  const { id } = await params;
  const existing = await getOwned(id, guard.id);
  if (!existing) return NextResponse.json({ error: "الموظف ده مش موجود" }, { status: 404 });
  // Removing someone who signs in removes their access too: the owner's.
  if (!guard.canManageAccess && (existing.userId || existing.access)) {
    return NextResponse.json({ error: "حذف موظف له حساب دخول لصاحب النشاط بس", code: "forbidden" }, { status: 403 });
  }

  await db.staffMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
