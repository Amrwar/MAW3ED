"use client";

import { useState, useRef } from "react";
import AboutSection from "./AboutSection";
import ServicesSection from "./ServicesSection";
import GallerySection from "./GallerySection";
import ReviewsSection from "./ReviewsSection";
import FAQSection from "./FAQSection";
import BookingWidget from "./BookingWidget";
import PublicBusinessCard from "@/components/shared/PublicBusinessCard";
import type { Service } from "@/types/service";
import type { Business } from "@/types/business";
import type { PublicBusiness } from "@/lib/data";

interface Props {
  business:          Business;
  services:          Service[];
  openDays:          number[];
  slug:              string;
  similarBusinesses: PublicBusiness[];
}

export default function CompanyContent({
  business,
  services,
  openDays,
  slug,
  similarBusinesses,
}: Props) {
  const [preselected, setPreselected] = useState<Service | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  function handleBookService(service: Service) {
    setPreselected(service);
    // Scroll to the booking widget smoothly
    setTimeout(() => {
      widgetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ── Left column ── */}
      <div className="lg:col-span-2">
        <AboutSection business={business} />
        <ServicesSection services={services} onBook={handleBookService} />
        <GallerySection />
        <ReviewsSection
          rating={business.rating}
          reviewCount={business.reviewCount}
        />
        <FAQSection />

        {/* Similar businesses */}
        {similarBusinesses.length > 0 && (
          <div className="py-8">
            <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-6">
              أعمال مشابهة
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {similarBusinesses.map((b) => (
                <PublicBusinessCard key={b.id} business={b} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Right column: Booking widget ── */}
      <div ref={widgetRef} id="booking">
        <BookingWidget
          services={services}
          businessName={business.nameAr}
          slug={slug}
          openDays={openDays}
          preselectedService={preselected}
        />
      </div>
    </div>
  );
}
