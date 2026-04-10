import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function getOwned(id: string, businessId: string) {
  return db.staffMember.findFirst({ where: { id, businessId } });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwned(id, session.user.businessId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { serviceIds, ...rest } = body;

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
      ...(serviceIds !== undefined && {
        services: {
          deleteMany: {},
          create: (serviceIds as string[]).map((sid) => ({ serviceId: sid })),
        },
      }),
    },
    include: { services: { include: { service: { select: { id: true, nameAr: true } } } } },
  });

  return NextResponse.json(member);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwned(id, session.user.businessId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.staffMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
