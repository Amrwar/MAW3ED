import { db } from "@/lib/db";
import { normalisePhone } from "@/lib/phone";
import { planCustomers, planServices, type ImportKindName, type ImportPlan, type CustomerRow, type ServiceRow } from "./csv";

/**
 * The database half of importing: what already exists, writing a
 * batch, and undoing one. Every query is scoped by businessId — the id
 * comes from the caller's session, never from the request body — so one
 * business can neither import into nor roll back another's records.
 */

export type AnyPlan = ImportPlan<CustomerRow> | ImportPlan<ServiceRow>;

export async function planImport(kind: ImportKindName, businessId: string, csv: string): Promise<AnyPlan> {
  if (kind === "CUSTOMERS") {
    const existing = await db.customer.findMany({ where: { businessId }, select: { phone: true } });
    const phones = new Set(existing.map((c) => normalisePhone(c.phone)).filter((p): p is string => !!p));
    return planCustomers(csv, phones);
  }
  const existing = await db.service.findMany({ where: { businessId }, select: { nameAr: true } });
  return planServices(csv, new Set(existing.map((s) => s.nameAr.trim().toLowerCase())));
}

/**
 * Writes the plan's valid rows and records the batch, in one
 * transaction: either every row and the batch exist, or nothing does.
 * Rows with errors or duplicates are never written.
 */
export async function commitImport(input: {
  kind: ImportKindName;
  businessId: string;
  userId: string;
  fileName: string | null;
  plan: AnyPlan;
}) {
  const { kind, businessId, userId, fileName, plan } = input;
  return db.$transaction(async (tx) => {
    let createdIds: string[] = [];
    if (kind === "CUSTOMERS") {
      const rows = plan.rows as CustomerRow[];
      const created = await tx.customer.createManyAndReturn({
        data: rows.map((r) => ({ businessId, name: r.name, phone: r.phone, email: r.email, notes: r.notes })),
        // A customer who booked between preview and commit, with the
        // number typed the same way, is left as they are.
        skipDuplicates: true,
        select: { id: true },
      });
      createdIds = created.map((c) => c.id);
    } else {
      const rows = plan.rows as ServiceRow[];
      const last = await tx.service.aggregate({ where: { businessId }, _max: { sortOrder: true } });
      const base = (last._max.sortOrder ?? 0) + 1;
      const created = await tx.service.createManyAndReturn({
        data: rows.map((r, i) => ({
          businessId,
          nameAr: r.nameAr,
          nameEn: r.nameEn,
          duration: r.duration,
          price: r.price,
          sortOrder: base + i,
        })),
        select: { id: true },
      });
      createdIds = created.map((s) => s.id);
    }
    return tx.importBatch.create({
      data: {
        businessId,
        kind,
        createdById: userId,
        fileName,
        rowCount: createdIds.length,
        createdIds,
        skipped: plan.total - createdIds.length,
      },
      select: { id: true, rowCount: true, skipped: true, createdAt: true },
    });
  });
}

export type RollbackResult =
  | { ok: true; removed: number; kept: number }
  | { ok: false; reason: "not-found" | "already-rolled-back" };

/**
 * Removes what a batch created — except records that have since been
 * used: a customer or service with a booking is kept, because deleting
 * it would take the booking with it. The count kept is reported.
 */
export async function rollbackImport(batchId: string, businessId: string): Promise<RollbackResult> {
  return db.$transaction(async (tx) => {
    const batch = await tx.importBatch.findFirst({ where: { id: batchId, businessId } });
    if (!batch) return { ok: false as const, reason: "not-found" as const };
    if (batch.rolledBackAt) return { ok: false as const, reason: "already-rolled-back" as const };

    // Claimed first, so of two rollbacks arriving together only one
    // deletes anything; the other sees zero rows claimed.
    const claimed = await tx.importBatch.updateMany({
      where: { id: batch.id, businessId, rolledBackAt: null },
      data: { rolledBackAt: new Date() },
    });
    if (claimed.count === 0) return { ok: false as const, reason: "already-rolled-back" as const };

    const where = { id: { in: batch.createdIds }, businessId, bookings: { none: {} } };
    const removed =
      batch.kind === "CUSTOMERS"
        ? (await tx.customer.deleteMany({ where })).count
        : (await tx.service.deleteMany({ where })).count;

    await tx.importBatch.update({ where: { id: batch.id }, data: { rolledBackCount: removed } });
    return { ok: true as const, removed, kept: batch.createdIds.length - removed };
  });
}
