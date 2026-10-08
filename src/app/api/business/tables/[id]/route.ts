import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/api";
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
    const { business } = await requireBusiness();
    return business;
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

async function getOwned(id: string, businessId: string) {
  return db.table.findFirst({ where: { id, businessId } });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await ownedBusiness();
  if (guard instanceof Response) return guard;

  const { id } = await params;
  const existing = await getOwned(id, guard.id);
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
  const guard = await ownedBusiness();
  if (guard instanceof Response) return guard;

  const { id } = await params;
  const existing = await getOwned(id, guard.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.table.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
