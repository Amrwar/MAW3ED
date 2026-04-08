import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getCategories, getCities } from "@/lib/data";
import SettingsClient from "./_components/SettingsClient";
import { getEffectivePlan, type Plan, type SubscriptionStatus } from "@/lib/plans";

export const metadata: Metadata = { title: "الإعدادات | موعد" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/dashboard");

  const [business, cities, categories] = await Promise.all([
    db.business.findUnique({
      where:   { id: session.user.businessId },
      include: {
        city:         true,
        category:     true,
        availability: { orderBy: { dayOfWeek: "asc" } },
        services:     { where: { isAvailable: true }, orderBy: { sortOrder: "asc" }, take: 5 },
      },
    }),
    getCities(),
    getCategories(),
  ]);

  if (!business) redirect("/dashboard");

  const profile = {
    id:         business.id,
    slug:       business.slug,
    nameAr:     business.nameAr,
    nameEn:     business.nameEn     ?? "",
    taglineAr:  business.taglineAr  ?? "",
    phone:      business.phone      ?? "",
    whatsapp:   business.whatsapp   ?? "",
    address:    business.address    ?? "",
    about:      business.about      ?? "",
    cityId:     business.cityId,
    categoryId: business.categoryId,
    logoImage:  business.logoImage,
    coverImage: business.coverImage,
    cityNameAr:     business.city.nameAr,
    categoryNameAr: business.category.nameAr,
    categoryIcon:   business.category.icon,
  };

  const availability = business.availability.map((a) => ({
    dayOfWeek: a.dayOfWeek,
    openTime:  a.openTime,
    closeTime: a.closeTime,
    isClosed:  a.isClosed,
  }));

  const fullWeek = Array.from({ length: 7 }, (_, i) => {
    const found = availability.find((a) => a.dayOfWeek === i);
    return found ?? { dayOfWeek: i, openTime: "09:00", closeTime: "21:00", isClosed: true };
  });

  const services = business.services.map((s) => ({
    nameAr:   s.nameAr,
    duration: s.duration,
    price:    Number(s.price),
    currency: s.currency,
  }));

  const effectivePlan = getEffectivePlan(
    business.plan as Plan,
    business.subscriptionStatus as SubscriptionStatus,
    business.trialEndsAt,
  );

  const daysUntilExpiry = business.currentPeriodEnd
    ? Math.ceil((business.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <SettingsClient
      profile={profile}
      availability={fullWeek}
      cities={cities.map((c) => ({ id: c.id, nameAr: c.nameAr }))}
      categories={categories.map((c) => ({ id: c.id, nameAr: c.nameAr, icon: c.icon }))}
      services={services}
      depositEnabled={business.depositEnabled}
      depositPercent={business.depositPercent}
      plan={business.plan as Plan}
      subscriptionStatus={business.subscriptionStatus as SubscriptionStatus}
      currentPeriodEnd={business.currentPeriodEnd?.toISOString().split("T")[0] ?? null}
      effectivePlan={effectivePlan}
      daysUntilExpiry={daysUntilExpiry}
    />
  );
}
