import { NextResponse } from "next/server";
import {
  PLAN_NAMES_AR,
  cheapestPlanWith,
  effectivePlanOf,
  limitOf,
  wouldExceed,
} from "@/lib/plans";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staff = await db.staffMember.findMany({
    where:   { businessId: session.user.businessId },
    orderBy: { createdAt: "asc" },
    include: {
      services: { include: { service: { select: { id: true, nameAr: true } } } },
      hours:    { orderBy: { dayOfWeek: "asc" } },
    },
  });

  return NextResponse.json(staff);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { nameAr, nameEn, role, photo, isActive, workingDays, specialties, serviceIds } = body;

  if (!nameAr?.trim()) return NextResponse.json({ error: "اسم الموظف بالعربية مطلوب" }, { status: 400 });

  // The ceiling is asked before creating and never after, so a plan
  // that lapses leaves the staff a business already has in place — it
  // simply cannot add to them.
  const business = await db.business.findUnique({
    where:  { id: session.user.businessId },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (!business) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan    = effectivePlanOf(business);
  const current = await db.staffMember.count({ where: { businessId: session.user.businessId } });

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
      businessId:  session.user.businessId,
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
}
