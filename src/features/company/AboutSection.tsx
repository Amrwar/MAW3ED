import { Info } from "lucide-react";
import type { Business } from "@/types/business";

export default function AboutSection({ business }: { business: Business }) {
  const text = business.about || business.taglineAr;
  if (!text) return null;

  return (
    <div
      className="rounded-3xl border p-6 md:p-8"
      style={{
        background:  "#FFFFFF",
        borderColor: "#E2E8F0",
        boxShadow:   "0 2px 12px rgba(15,23,42,0.04)",
      }}
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-1 h-6 rounded-full shrink-0"
          style={{ background: "linear-gradient(to bottom, #1D4ED8, #3B82F6)" }}
        />
        <h2 className="text-xl font-black text-[#0F172A]">
          عن {business.nameAr}
        </h2>
      </div>

      {/* Body text */}
      <p
        className="text-[#475569] leading-loose text-[15px]"
        style={{ lineHeight: 1.85 }}
      >
        {text}
      </p>

      {/* Tags */}
      {business.tags && business.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-6 pt-5" style={{ borderTop: "1px solid #F1F5F9" }}>
          {business.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 text-xs font-semibold rounded-full"
              style={{
                background:  "#F8FAFC",
                color:       "#475569",
                border:      "1px solid #E2E8F0",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
