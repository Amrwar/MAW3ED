import { NextResponse } from "next/server";
import {
  PLAN_NAMES_AR,
  cheapestPlanWith,
  effectivePlanOf,
  limitOf,
  wouldExceed,
} from "@/lib/plans";
import { requireBusiness } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * requireBusiness rather than auth() + session.user.businessId: it
 * accepts the mobile app's bearer token, which auth() refused, and it
 * confirms against the database that the caller still owns the business
 * instead of trusting an id carried in a long-lived token.
 */

export async function GET() {
  try {
    const { business } = await requireBusiness();

    const staff = await db.staffMember.findMany({
      where:   { businessId: business.id },
      orderBy: { createdAt: "asc" },
      include: {
        services: { include: { service: { select: { id: true, nameAr: true } } } },
        hours:    { orderBy: { dayOfWeek: "asc" } },
      },
    });

    return NextResponse.json(staff);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const { business: owned } = await requireBusiness();

    const body = await req.json();
  const { nameAr, nameEn, role, photo, isActive, workingDays, specialties, serviceIds } = body;

  if (!nameAr?.trim()) return NextResponse.json({ error: "اسم الموظف بالعربية مطلوب" }, { status: 400 });

  // The ceiling is asked before creating and never after, so a plan
  // that lapses leaves the staff a business already has in place — it
  // simply cannot add to them.
  const business = await db.business.findUnique({
    where:  { id: owned.id },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!business) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan    = effectivePlanOf(business);
  const current = await db.staffMember.count({ where: { businessId: owned.id } });

  if (wouldExceed(plan, "staffMembers", current)) {
    const ceiling = limitOf(plan, "staffMembers");
    const upgrade = cheapestPlanWith("staffMembers");
    return NextResponse.json(
      {
        error: ceiling === 0
          ? `إضافة فريق متاحة في خطة ${upgrade ? PLAN_NAMES_AR[upgrade] : "مدفوعة"}.`
          : `وصلت للحد الأقصى (${ceiling} أفراد) في خطتك الحالية.`,
      },
      { status: 403 },
    );
  }

  const member = await db.staffMember.create({
    data: {
      businessId:  owned.id,
      nameAr:      nameAr.trim(),
      nameEn:      nameEn?.trim()  || null,
      role:        role?.trim()    || null,
      photo:       photo?.trim()   || null,
      isActive:    isActive ?? true,
      workingDays: workingDays ?? [],
      specialties: specialties ?? [],
      services:    serviceIds?.length
        ? { create: (serviceIds as string[]).map((sid) => ({ serviceId: sid })) }
        : undefined,
    },
    include: {
      services: { include: { service: { select: { id: true, nameAr: true } } } },
      hours:    { orderBy: { dayOfWeek: "asc" } },
    },
  });

    return NextResponse.json(member, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
