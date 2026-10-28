"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TrafficSource } from "@prisma/client";
import AboutSection from "./AboutSection";
import ServicesSection, { type ServiceProvider } from "./ServicesSection";
import GallerySection, { type GalleryImage } from "./GallerySection";
import ReviewsSection from "./ReviewsSection";
import LocationSection from "./LocationSection";
import FAQSection from "./FAQSection";
import BookingWidget from "./BookingWidget";
import ProfileNav, { type NavSection } from "./ProfileNav";
import BusinessCard from "@/components/shared/BusinessCard";
import type { Service } from "@/types/service";
import type { Business } from "@/types/business";
import type { PublicBusiness } from "@/lib/data";
import type { DayHours } from "@/lib/discovery/hours";
import type { PublicReview, RatingSummary } from "@/lib/reviews";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ResourceKind } from "@/lib/scheduling/resource-labels";

/**
 * A thing an appointment holds: a table, a room, a chair, a machine.
 * One shape for all of them — the kind only decides what it is called.
 */
export type PublicResource = {
  id:       string;
  name:     string;
  kind:     ResourceKind;
  /** Seats or beds, when the kind counts anything. Null when it does not. */
  capacity: number | null;
  area:     string | null;
  notes:    string | null;
  photo:    string | null;
};

export type PublicStaff = {
  id:         string;
  nameAr:     string;
  nameEn:     string | null;
  role:       string | null;
  photo:      string | null;
  serviceIds: string[];
};

interface Props {
  business:          Business;
  services:          Service[];
  openDays:          number[];
  slug:              string;
  similarBusinesses: PublicBusiness[];
  businessType:      "GENERAL" | "RESTAURANT" | "BARBERSHOP";
  /** Where this visitor came from, worked out on the server. */
  source:            TrafficSource;
  resources:         PublicResource[];
  staffMembers:      PublicStaff[];
  hours:             DayHours[];
  images:            GalleryImage[];
  summary:           RatingSummary;
  reviews:           PublicReview[];
  reviewsMatched:    number;
  neighborhoodName:  string | null;
  nextSlot:          { dayOffset: number; time: string } | null;
  branches:          { id: string; nameAr: string; address: string | null }[];
  depositEnabled:    boolean;
  depositPercent:    number;
  /** Hours before the appointment until which a customer can cancel or move it themselves. */
  changeCutoffHours: number;
  /**
   * A service chosen before arriving — the app's "Book this" opens
   * /company/<slug>?service=<id> — so the widget starts on the next step
   * instead of asking again.
   */
  initialServiceId?: string | null;
  /** With it, the provider they chose: ?staff=<id>. */
  initialStaffId?:   string | null;
}

export default function CompanyContent({
  business,
  services,
  openDays,
  slug,
  similarBusinesses,
  businessType,
  source,
  resources,
  staffMembers,
  hours,
  images,
  summary,
  reviews,
  reviewsMatched,
  neighborhoodName,
  nextSlot,
  branches,
  depositEnabled,
  depositPercent,
  changeCutoffHours,
  initialServiceId = null,
  initialStaffId = null,
}: Props) {
  const { t, lang } = useLanguage();
  const [preselected, setPreselected] = useState<Service | null>(
    () => services.find((s) => s.id === initialServiceId) ?? null,
  );
  const widgetRef = useRef<HTMLDivElement>(null);

  // Arriving with a service chosen: take the visitor to the widget once.
  const arrivedWithService = useRef(preselected !== null);
  useEffect(() => {
    if (!arrivedWithService.current) return;
    arrivedWithService.current = false;
    widgetRef.current?.scrollIntoView({ block: "start" });
  }, []);

  function handleBookService(service: Service) {
    setPreselected(service);
    setTimeout(() => {
      widgetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  const providers: ServiceProvider[] = staffMembers.map((s) => ({
    id: s.id,
    name: lang === "en" && s.nameEn ? s.nameEn : s.nameAr,
    serviceIds: s.serviceIds,
  }));

  const hasAbout = Boolean(business.about?.trim());

  // Only sections that actually render get a tab, so the bar can never
  // point at an anchor that is not on the page.
  const sections: NavSection[] = useMemo(() => {
    const tabs = t.profile.tabs;
    const out: NavSection[] = [];
    if (services.length > 0) out.push({ id: "services", label: tabs.services });
    if (hasAbout) out.push({ id: "about", label: tabs.about });
    out.push({ id: "reviews", label: tabs.reviews });
    if (images.length > 0) out.push({ id: "gallery", label: tabs.gallery });
    out.push({ id: "location", label: tabs.location });
    out.push({ id: "faq", label: tabs.faq });
    return out;
  }, [services.length, hasAbout, images.length, t.profile.tabs]);

  return (
    <>
      <ProfileNav sections={sections} />

      <div className="bg-[var(--color-ground)] pb-32 lg:pb-16">
        <div className="container-app py-10">
          <div className="flex flex-wrap items-start gap-9">

            {/* ── Main column ── */}
            <div className="min-w-0 flex-[999_1_34rem] space-y-10">
              <ServicesSection
                services={services}
                providers={providers}
                nextSlot={nextSlot}
                onBook={handleBookService}
              />

              {hasAbout && <AboutSection business={business} />}

              <ReviewsSection
                businessSlug={slug}
                summary={summary}
                initialReviews={reviews}
                initialMatched={reviewsMatched}
              />

              {images.length > 0 && (
                <GallerySection images={images} businessName={business.nameAr} />
              )}

              <LocationSection
                name={business.nameAr}
                address={business.address ?? null}
                cityName={business.locationAr}
                neighborhoodName={neighborhoodName}
                phone={business.phone ?? null}
                hours={hours}
              />

              <FAQSection
                changeCutoffHours={changeCutoffHours}
                depositEnabled={depositEnabled}
                depositPercent={depositPercent}
              />

              {similarBusinesses.length > 0 && (
                <section>
                  <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">
                    {lang === "ar" ? "أنشطة مشابهة" : "Similar businesses"}
                  </h2>
                  <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2">
                    {similarBusinesses.map((b) => (
                      <li key={b.id} className="min-w-0">
                        <BusinessCard business={b} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* ── Booking widget ── */}
            <div
              ref={widgetRef}
              id="booking"
              className="w-full min-w-[18rem] flex-[0_1_22.5rem] scroll-mt-32 lg:sticky lg:top-[7.5rem] lg:max-h-[calc(100dvh-8.5rem)] lg:overflow-y-auto lg:overscroll-contain"
            >
              {/* Pinned, the widget can be taller than the window on a
                  laptop screen; capped to what is left under the two
                  bars and scrolling inside, its Back and Review buttons
                  stay reachable. */}
              <BookingWidget
                services={services}
                businessName={business.nameAr}
                slug={slug}
                openDays={openDays}
                preselectedService={preselected}
                initialStaffId={initialStaffId}
                businessType={businessType}
                source={source}
                resources={resources}
                staffMembers={staffMembers}
                branches={branches}
                depositEnabled={depositEnabled}
                depositPercent={depositPercent}
                changeCutoffHours={changeCutoffHours}
              />
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
