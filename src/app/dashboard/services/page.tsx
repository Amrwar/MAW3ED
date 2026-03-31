import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import ServicesClient from "./_components/ServicesClient";

export const metadata: Metadata = { title: "الخدمات | موعد" };

export default async function ServicesPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/dashboard");

  const services = await db.service.findMany({
    where:   { businessId: session.user.businessId },
    orderBy: { sortOrder: "asc" },
  });

  const serialized = services.map((s) => ({
    id:            s.id,
    nameAr:        s.nameAr,
    nameEn:        s.nameEn ?? "",
    descriptionAr: s.descriptionAr ?? "",
    duration:      s.duration,
    price:         Number(s.price),
    currency:      s.currency,
    isAvailable:   s.isAvailable,
    sortOrder:     s.sortOrder,
  }));

  return <ServicesClient initialServices={serialized} />;
}
