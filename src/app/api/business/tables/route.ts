import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tables = await db.table.findMany({
    where:   { businessId: session.user.businessId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(tables);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, tableType, capacity, notes, photo, isActive } = body;

  if (!name?.trim()) return NextResponse.json({ error: "اسم الطاولة مطلوب" }, { status: 400 });
  if (!capacity || capacity < 1) return NextResponse.json({ error: "السعة يجب أن تكون 1 على الأقل" }, { status: 400 });

  const table = await db.table.create({
    data: {
      businessId: session.user.businessId,
      name:       name.trim(),
      tableType:  tableType ?? "MIDDLE",
      capacity:   Number(capacity),
      notes:      notes?.trim() || null,
      photo:      photo?.trim() || null,
      isActive:   isActive ?? true,
    },
  });

  return NextResponse.json(table, { status: 201 });
}
