import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/api";
import { db } from "@/lib/db";

/**
 * requireBusiness rather than auth() + session.user.businessId.
 *
 * Two things change. It accepts the bearer token the mobile app sends,
 * which auth() alone refused — these endpoints answered 401 to the app.
 * And it re-reads the business from the database and checks the caller
 * still owns it, instead of trusting a businessId copied out of a JWT
 * that may be sixty days old.
 */

export async function GET() {
  try {
    const { business } = await requireBusiness();

    const tables = await db.table.findMany({
      where:   { businessId: business.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(tables);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    const { business } = await requireBusiness();

    const body = await req.json();
  const { name, tableType, capacity, notes, photo, isActive } = body;

  if (!name?.trim()) return NextResponse.json({ error: "اسم الطاولة مطلوب" }, { status: 400 });
  if (!capacity || capacity < 1) return NextResponse.json({ error: "السعة يجب أن تكون 1 على الأقل" }, { status: 400 });

  const table = await db.table.create({
    data: {
      businessId: business.id,
      name:       name.trim(),
      tableType:  tableType ?? "MIDDLE",
      capacity:   Number(capacity),
      notes:      notes?.trim() || null,
      photo:      photo?.trim() || null,
      isActive:   isActive ?? true,
    },
  });

    return NextResponse.json(table, { status: 201 });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
