import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { adminMetadata } from "@/lib/admin/meta";
import { AdminHeading } from "../_components/AdminBits";
import VenuesAdminClient from "./_components/VenuesAdminClient";

export const generateMetadata = adminMetadata("venues.read", "الأماكن");

/**
 * Destinations, from the platform's side: who runs what, which venues
 * exist, which are public, and who manages each. Everything here is
 * data an operator supplied — creating a venue implies no partnership
 * and publishes nothing until an administrator publishes it.
 */
export default async function AdminVenuesPage() {
  const actor = await requireAdminPage("venues.read");
  const [organizations, compounds, venues, cities, roles] = await Promise.all([
    db.organization.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, slug: true, kind: true, nameAr: true, status: true, isPublished: true, createdAt: true,
        _count: { select: { associations: { where: { status: "APPROVED" } }, venues: true } },
      },
    }),
    db.compound.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, slug: true, nameAr: true, cityId: true, organizationId: true } }),
    db.venue.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, slug: true, nameAr: true, status: true, isPublished: true, kind: true,
        city: { select: { nameAr: true } }, compound: { select: { nameAr: true } }, organization: { select: { nameAr: true } },
        _count: { select: { memberships: { where: { status: "APPROVED" } } } },
      },
    }),
    db.city.findMany({ orderBy: { nameAr: "asc" }, select: { id: true, nameAr: true } }),
    db.venueRole.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, kind: true,
        user: { select: { name: true, email: true } },
        organization: { select: { nameAr: true } }, compound: { select: { nameAr: true } }, venue: { select: { nameAr: true } },
      },
    }),
  ]);

  return (
    <div>
      <AdminHeading
        title="الأماكن والمولات"
        subtitle="الجهات والكمبوندات والأماكن ومين بيديرها. المكان بيتعمل مسودة ومش بيظهر للناس غير لما يتفعّل ويتنشر من هنا."
      />
      <VenuesAdminClient
        canManage={can(actor.role, "venues.manage")}
        organizations={organizations.map((o) => ({ ...o, createdAt: o.createdAt.toISOString(), tenants: o._count.associations, venueCount: o._count.venues }))}
        compounds={compounds}
        cities={cities}
        venues={venues.map((v) => ({ ...v, tenants: v._count.memberships }))}
        roles={roles}
      />
    </div>
  );
}
