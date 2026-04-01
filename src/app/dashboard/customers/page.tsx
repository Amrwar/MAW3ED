import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import CustomersClient from "./_components/CustomersClient";
import type { CustomerRow } from "@/app/api/business/customers/route";

export const metadata: Metadata = { title: "العملاء | موعد" };

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/onboarding");

  const businessId = session.user.businessId;

  const raw = await db.customer.findMany({
    where:   { businessId },
    include: {
      bookings: {
        select: { totalPrice: true, date: true, status: true, currency: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const initialCustomers: CustomerRow[] = raw.map((c) => {
    const active   = c.bookings.filter((b) => b.status !== "CANCELLED");
    const revenue  = c.bookings
      .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);
    const sorted   = [...active].sort((a, b) => b.date.getTime() - a.date.getTime());
    const currency = c.bookings[0]?.currency ?? "EGP";

    return {
      id:              c.id,
      name:            c.name,
      phone:           c.phone,
      email:           c.email,
      notes:           c.notes,
      createdAt:       c.createdAt.toISOString(),
      bookingCount:    active.length,
      totalSpend:      revenue,
      lastBookingDate: sorted[0]?.date.toISOString().split("T")[0] ?? null,
      currency,
    };
  });

  return <CustomersClient initialCustomers={initialCustomers} />;
}
