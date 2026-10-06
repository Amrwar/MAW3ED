import type { BusinessStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { AdminHeading } from "../_components/AdminBits";
import BusinessesClient from "./_components/BusinessesClient";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("businesses.read", "الأعمال");

const STATUSES: BusinessStatus[] = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdminPage("businesses.read");
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const status = one("status");
  const q = one("q")?.trim();

  const where: Prisma.BusinessWhereInput = {
    ...(status && STATUSES.includes(status as BusinessStatus)
      ? { status: status as BusinessStatus }
      : {}),
    ...(q
      ? {
          OR: [
            { nameAr: { contains: q, mode: "insensitive" } },
            { nameEn: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { owner: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [businesses, counts] = await Promise.all([
    db.business.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        slug: true,
        nameAr: true,
        status: true,
        statusNote: true,
        isVerified: true,
        isFeatured: true,
        isPublished: true,
        plan: true,
        createdAt: true,
        statusChangedAt: true,
        city: { select: { nameAr: true } },
        category: { select: { nameAr: true } },
        owner: { select: { email: true, name: true } },
        _count: { select: { bookings: true, services: true } },
      },
    }),
    db.business.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const tally: Record<string, number> = {};
  for (const c of counts) tally[c.status] = c._count._all;

  return (
    <div>
      <AdminHeading
        title="الأعمال"
        subtitle="قبول، رفض، إيقاف، توثيق وتمييز — وكل إجراء بيتسجّل."
      />
      <BusinessesClient
        canModerate={can(actor.role, "businesses.moderate")}
        canVerify={can(actor.role, "businesses.verify")}
        activeStatus={status ?? ""}
        query={q ?? ""}
        tally={tally}
        rows={businesses.map((b) => ({
          id: b.id,
          slug: b.slug,
          name: b.nameAr,
          status: b.status,
          statusNote: b.statusNote,
          isVerified: b.isVerified,
          isFeatured: b.isFeatured,
          isPublished: b.isPublished,
          plan: b.plan,
          city: b.city.nameAr,
          category: b.category.nameAr,
          ownerEmail: b.owner.email,
          ownerName: b.owner.name,
          bookings: b._count.bookings,
          services: b._count.services,
          createdAt: b.createdAt.toISOString(),
          statusChangedAt: b.statusChangedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
