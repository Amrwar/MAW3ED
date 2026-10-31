import type { Metadata } from "next";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { can } from "@/lib/business-access";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getCategories, getCities } from "@/lib/data";
import SettingsClient from "./_components/SettingsClient";
import type { NotificationPrefs } from "./_components/NotificationSettingsForm";

/** What a delegate's browser receives in place of the owner's private settings. */
const NO_PRIVATE_PREFS: NotificationPrefs = {
  notifyByEmail: false, notifyByWhatsApp: false, notifyNewBooking: false, notifyCancellation: false,
  notifyPayment: false, notificationEmail: null, notificationPhone: null, reminderEnabled: false,
  reminderLeadHours: 0, startingSoonEnabled: false, startingSoonLeadMins: 0, reviewRequestEnabled: false,
};
import { getEffectivePlan, type Plan, type SubscriptionStatus } from "@/lib/plans";
import { daysUntil } from "@/lib/fmt";

export const metadata: Metadata = { title: "الإعدادات" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: initialTab } = await searchParams;
  // The owner sees every tab. A delegate sees the profile (PROFILE) and
  // the opening hours (SCHEDULES) it was granted, and nothing else —
  // including none of the owner's private settings, which are not even
  // sent to its browser.
  const { business: acting, actor } = await requireDashboardAccess(["profile.manage", "schedule.manage"]);
  const isOwner = actor.role === "OWNER";
  const tabs = isOwner
    ? undefined
    : ([
        ...(can(actor, "profile.manage") ? (["profile"] as const) : []),
        ...(can(actor, "schedule.manage") ? (["availability"] as const) : []),
        ...(can(actor, "profile.manage") ? (["preview"] as const) : []),
      ]);

  const [business, cities, categories] = await Promise.all([
    db.business.findUnique({
      where:   { id: acting.id },
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
    location:
      business.latitude !== null && business.longitude !== null
        ? { lat: business.latitude, lng: business.longitude }
        : null,
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

  // One clock read per request. This is a server component, so there is
  // no re-render for the value to drift across.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const effectivePlan = getEffectivePlan(
    business.plan as Plan,
    business.subscriptionStatus as SubscriptionStatus,
    business.trialEndsAt,
  );

  const daysUntilExpiry = business.currentPeriodEnd
    ? daysUntil(business.currentPeriodEnd, now)
    : null;

  return (
    <SettingsClient
      initialTab={initialTab}
      profile={profile}
      availability={fullWeek}
      cities={cities.map((c) => ({ id: c.id, nameAr: c.nameAr }))}
      categories={categories.map((c) => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn ?? c.nameAr, icon: c.icon }))}
      services={services}
      tabs={tabs}
      showAutoConfirm={isOwner}
      notificationPrefs={isOwner ? {
        notifyByEmail:        business.notifyByEmail,
        notifyByWhatsApp:     business.notifyByWhatsApp,
        notifyNewBooking:     business.notifyNewBooking,
        notifyCancellation:   business.notifyCancellation,
        notifyPayment:        business.notifyPayment,
        notificationEmail:    business.notificationEmail,
        notificationPhone:    business.notificationPhone,
        reminderEnabled:      business.reminderEnabled,
        reminderLeadHours:    business.reminderLeadHours,
        startingSoonEnabled:  business.startingSoonEnabled,
        startingSoonLeadMins: business.startingSoonLeadMins,
        reviewRequestEnabled: business.reviewRequestEnabled,
      } : NO_PRIVATE_PREFS}
      depositEnabled={isOwner && business.depositEnabled}
      autoConfirm={isOwner && business.autoConfirm}
      depositPercent={isOwner ? business.depositPercent : 0}
      plan={(isOwner ? business.plan : "FREE") as Plan}
      subscriptionStatus={(isOwner ? business.subscriptionStatus : "ACTIVE") as SubscriptionStatus}
      currentPeriodEnd={isOwner ? (business.currentPeriodEnd?.toISOString().split("T")[0] ?? null) : null}
      effectivePlan={isOwner ? effectivePlan : ("FREE" as Plan)}
      daysUntilExpiry={isOwner ? daysUntilExpiry : null}
    />
  );
}
