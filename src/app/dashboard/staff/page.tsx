import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import StaffClient from "./_components/StaffClient";

export const metadata: Metadata = { title: "الفريق" };

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/dashboard");

  const [staffMembers, services] = await Promise.all([
    db.staffMember.findMany({
      where:   { businessId: session.user.businessId },
      include: { services: { include: { service: { select: { id: true, nameAr: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    db.service.findMany({
      where:   { businessId: session.user.businessId, isAvailable: true },
      select:  { id: true, nameAr: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const serialized = staffMembers.map((m) => ({
    id:          m.id,
    nameAr:      m.nameAr,
    nameEn:      m.nameEn ?? "",
    role:        m.role ?? "",
    photo:       m.photo ?? "",
    isActive:    m.isActive,
    workingDays: m.workingDays as number[],
    specialties: m.specialties as string[],
    serviceIds:  m.services.map((ss) => ss.serviceId),
    serviceNames: m.services.map((ss) => ss.service.nameAr),
  }));

  return (
    <StaffClient
      initialStaff={serialized}
      availableServices={services.map((s) => ({ id: s.id, nameAr: s.nameAr }))}
    />
  );
}
