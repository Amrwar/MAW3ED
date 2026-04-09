"use client";

import { useState } from "react";
import { Clock, ArrowLeft } from "lucide-react";
import type { Service } from "@/types/service";
import { formatDuration, formatPrice } from "@/lib/utils";

interface Props {
  services: Service[];
  onBook?:  (service: Service) => void;
}

// Gradient icon backgrounds cycling for visual variety
const ICON_GRADIENTS = [
  "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
  "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
  "linear-gradient(135deg, #059669 0%, #34D399 100%)",
  "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
  "linear-gradient(135deg, #0E7490 0%, #22D3EE 100%)",
  "linear-gradient(135deg, #9D174D 0%, #F472B6 100%)",
];

export default function ServicesSection({ services, onBook }: Props) {
  const categories     = [...new Set(services.map((s) => s.category).filter(Boolean))];
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered =
    activeCategory === "all"
      ? services
      : services.filter((s) => s.category === activeCategory);

  if (services.length === 0) return null;

  return (
    <div
      id="services"
      className="rounded-3xl border p-6 md:p-8"
      style={{
        background:  "#FFFFFF",
        borderColor: "#E2E8F0",
        boxShadow:   "0 2px 12px rgba(15,23,42,0.04)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-1 h-6 rounded-full shrink-0"
            style={{ background: "linear-gradient(to bottom, #1D4ED8, #3B82F6)" }}
          />
          <h2 className="text-xl font-black text-[#0F172A]">الخدمات</h2>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: "#DBEAFE", color: "#1D4ED8" }}
        >
          {services.length} خدمة
        </span>
      </div>

      {/* Category filter tabs */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory("all")}
            className="px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200"
            style={{
              background:  activeCategory === "all" ? "#1D4ED8" : "#F8FAFC",
              color:       activeCategory === "all" ? "#FFFFFF" : "#475569",
              borderColor: activeCategory === "all" ? "#1D4ED8" : "#E2E8F0",
            }}
          >
            الكل
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat!)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200"
              style={{
                background:  activeCategory === cat ? "#1D4ED8" : "#F8FAFC",
                color:       activeCategory === cat ? "#FFFFFF" : "#475569",
                borderColor: activeCategory === cat ? "#1D4ED8" : "#E2E8F0",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Service cards */}
      <div className="space-y-3">
        {filtered.map((service, idx) => (
          <div
            key={service.id}
            className="flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200"
            style={{
              background:  "#FAFBFD",
              borderColor: "#E2E8F0",
              boxShadow:   "0 1px 4px rgba(15,23,42,0.03)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = "rgba(147,197,253,0.6)";
              el.style.boxShadow   = "0 4px 16px rgba(59,130,246,0.08)";
              el.style.transform   = "translateY(-1px)";
              el.style.background  = "#FFFFFF";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = "#E2E8F0";
              el.style.boxShadow   = "0 1px 4px rgba(15,23,42,0.03)";
              el.style.transform   = "translateY(0)";
              el.style.background  = "#FAFBFD";
            }}
          >
            {/* Gradient icon box */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white text-lg font-black"
              style={{ background: ICON_GRADIENTS[idx % ICON_GRADIENTS.length] }}
            >
              {service.nameAr.charAt(0)}
            </div>

            {/* Service info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#0F172A] text-[15px] leading-snug mb-0.5">
                {service.nameAr}
              </p>
              {service.descriptionAr && (
                <p className="text-xs text-[#94A3B8] line-clamp-1 mb-1">
                  {service.descriptionAr}
                </p>
              )}
              {service.duration > 0 && (
                <div className="flex items-center gap-1">
                  <Clock size={11} className="text-[#94A3B8]" />
                  <span className="text-xs text-[#94A3B8]">
                    {formatDuration(service.duration)}
                  </span>
                </div>
              )}
            </div>

            {/* Price + CTA */}
            <div className="text-end shrink-0">
              <p className="font-black text-[#0F172A] text-base mb-2">
                {formatPrice(service.price, service.currency)}
              </p>
              <button
                onClick={() => onBook?.(service)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                  boxShadow:  "0 2px 10px rgba(59,130,246,0.30)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.boxShadow = "0 4px 16px rgba(59,130,246,0.45)";
                  el.style.filter    = "brightness(1.06)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.boxShadow = "0 2px 10px rgba(59,130,246,0.30)";
                  el.style.filter    = "";
                }}
              >
                احجز
                <ArrowLeft size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
