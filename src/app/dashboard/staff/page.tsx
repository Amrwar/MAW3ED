import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import StaffClient from "./_components/StaffClient";

export const metadata: Metadata = { title: "الفريق" };

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/dashboard");

  const [staffMembers, services, businessHours, timeBlocks] = await Promise.all([
    db.staffMember.findMany({
      where:   { businessId: session.user.businessId },
      include: {
        services: { include: { service: { select: { id: true, nameAr: true } } } },
        hours:    { orderBy: { dayOfWeek: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.service.findMany({
      where:   { businessId: session.user.businessId, isAvailable: true },
      select:  { id: true, nameAr: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.availabilityRule.findMany({
      where:  { businessId: session.user.businessId },
      select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
      orderBy: { dayOfWeek: "asc" },
    }),
    // Only the blocks that belong to a person; whole-business holidays
    // are managed from settings, not from one member's panel.
    db.timeBlock.findMany({
      where:  { businessId: session.user.businessId, staffMemberId: { not: null } },
      orderBy: [{ startsOn: "asc" }, { dayOfWeek: "asc" }],
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
    hours: m.hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      startTime: h.startTime,
      endTime:   h.endTime,
      isOff:     h.isOff,
    })),
  }));

  return (
    <StaffClient
      initialStaff={serialized}
      availableServices={services.map((s) => ({ id: s.id, nameAr: s.nameAr }))}
      businessHours={businessHours}
      timeBlocks={timeBlocks.map((b) => ({
        id:            b.id,
        kind:          b.kind,
        staffMemberId: b.staffMemberId,
        dayOfWeek:     b.dayOfWeek,
        startsOn:      b.startsOn ? b.startsOn.toISOString().slice(0, 10) : null,
        endsOn:        b.endsOn ? b.endsOn.toISOString().slice(0, 10) : null,
        startTime:     b.startTime,
        endTime:       b.endTime,
        reason:        b.reason,
      }))}
    />
  );
}
