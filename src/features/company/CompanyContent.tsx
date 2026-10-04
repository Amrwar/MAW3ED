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

export type PublicTable = {
  id:        string;
  name:      string;
  tableType: string;
  capacity:  number;
  notes:     string | null;
  photo:     string | null;
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
  tables:            PublicTable[];
  staffMembers:      PublicStaff[];
}

export default function CompanyContent({
  business,
  services,
  openDays,
  slug,
  similarBusinesses,
  businessType,
  tables,
  staffMembers,
}: Props) {
  const [preselected, setPreselected] = useState<Service | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  function handleBookService(service: Service) {
    setPreselected(service);
    setTimeout(() => {
      widgetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <div className="bg-[var(--color-ground)] pb-32 lg:pb-16">
      <div>
        <div className="container-app py-10">
          <div className="flex flex-wrap items-start gap-9">

            {/* ── Main content column ── */}
            <div className="flex-[999_1_34rem] min-w-0 space-y-10">
              <AboutSection business={business} />
              <ServicesSection services={services} onBook={handleBookService} />
              <GallerySection />
              <ReviewsSection rating={business.rating} reviewCount={business.reviewCount} />
              <FAQSection />

              {/* Similar businesses */}
              {similarBusinesses.length > 0 && (
                <section>
                  <h2 className="mb-5 text-[1.5rem] font-bold text-[var(--color-ink)]">
                    أنشطة مشابهة
                  </h2>
                  <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {similarBusinesses.map((b) => (
                      <li key={b.id} className="min-w-0">
                        <PublicBusinessCard business={b} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* ── Booking widget sidebar ── */}
            <div
              ref={widgetRef}
              id="booking"
              className="w-full flex-[0_1_22.5rem] min-w-[18rem] lg:sticky lg:top-[6rem]"
            >
              <BookingWidget
                services={services}
                businessName={business.nameAr}
                slug={slug}
                openDays={openDays}
                preselectedService={preselected}
                businessType={businessType}
                tables={tables}
                staffMembers={staffMembers}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
