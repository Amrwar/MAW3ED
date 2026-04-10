import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

async function getOwned(id: string, businessId: string) {
  return db.table.findFirst({ where: { id, businessId } });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwned(id, session.user.businessId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const table = await db.table.update({
    where: { id },
    data: {
      name:      body.name?.trim()    ?? existing.name,
      tableType: body.tableType       ?? existing.tableType,
      capacity:  body.capacity != null ? Number(body.capacity) : existing.capacity,
      notes:     "notes"  in body ? (body.notes?.trim() || null) : existing.notes,
      photo:     "photo"  in body ? (body.photo?.trim() || null) : existing.photo,
      isActive:  body.isActive != null ? body.isActive : existing.isActive,
    },
  });

  return NextResponse.json(table);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getOwned(id, session.user.businessId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.table.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
