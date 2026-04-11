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
    <div
      className="pb-32 lg:pb-16"
      style={{ background: "#F8FAFC" }}
      dir="rtl"
    >
      {/* Subtle ambient glows */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            insetInlineStart: "-10%",
            top: "5%",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            insetInlineEnd: "-8%",
            top: "30%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 60%)",
          }}
        />

        <div className="container-app relative z-10 py-8 lg:py-10">
          <div className="flex flex-col lg:flex-row gap-7 items-start">

            {/* ── Main content column ── */}
            <div className="flex-1 min-w-0 space-y-5">
              <AboutSection business={business} />
              <ServicesSection services={services} onBook={handleBookService} />
              <GallerySection />
              <ReviewsSection rating={business.rating} reviewCount={business.reviewCount} />
              <FAQSection />

              {/* Similar businesses */}
              {similarBusinesses.length > 0 && (
                <div
                  className="rounded-3xl border p-6 md:p-8"
                  style={{
                    background: "#FFFFFF",
                    borderColor: "#E2E8F0",
                    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
                  }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-1 h-6 rounded-full shrink-0"
                      style={{ background: "linear-gradient(to bottom, #1D4ED8, #3B82F6)" }}
                    />
                    <h2 className="text-xl font-black text-[#0F172A]">
                      أعمال مشابهة
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {similarBusinesses.map((b) => (
                      <PublicBusinessCard key={b.id} business={b} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Booking widget sidebar ── */}
            <div
              ref={widgetRef}
              id="booking"
              className="w-full lg:w-[360px] xl:w-[390px] shrink-0 lg:sticky"
              style={{ top: "84px" }}
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
