import { MapPin, Clock, Phone, MessageCircle } from "lucide-react";
import type { Business } from "@/types/business";

export default function BusinessInfoRow({ business }: { business: Business }) {
  const today      = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayHours = business.hours?.find((h) => h.day === today);

  const hasAny =
    business.address || todayHours || business.phone || business.whatsapp;

  if (!hasAny) return null;

  return (
    <div
      className="border-b"
      style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}
      dir="rtl"
    >
      <div className="container-app py-3.5">
        <div className="flex flex-wrap gap-2.5">

          {/* Address */}
          {business.address && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm"
              style={{
                background: "#FFFFFF",
                border:     "1px solid #E2E8F0",
                boxShadow:  "0 1px 4px rgba(15,23,42,0.04)",
              }}
            >
              <MapPin size={14} className="text-[#3B82F6] shrink-0" />
              <span className="text-[#0F172A] font-medium">{business.address}</span>
            </div>
          )}

          {/* Today's hours */}
          {todayHours && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm"
              style={{
                background: "#FFFFFF",
                border:     "1px solid #E2E8F0",
                boxShadow:  "0 1px 4px rgba(15,23,42,0.04)",
              }}
            >
              <Clock size={14} className="text-[#3B82F6] shrink-0" />
              <span className="text-[#94A3B8] text-xs">اليوم:</span>
              <span className="text-[#0F172A] font-medium">
                {todayHours.closed ? "مغلق" : `${todayHours.open} – ${todayHours.close}`}
              </span>
            </div>
          )}

          {/* Phone — clickable */}
          {business.phone && (
            <a
              href={`tel:${business.phone}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm transition-all duration-200"
              style={{
                background: "#FFFFFF",
                border:     "1px solid #E2E8F0",
                boxShadow:  "0 1px 4px rgba(15,23,42,0.04)",
                color:      "#0F172A",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = "#BFDBFE";
                el.style.color       = "#1D4ED8";
                el.style.background  = "#EFF6FF";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = "#E2E8F0";
                el.style.color       = "#0F172A";
                el.style.background  = "#FFFFFF";
              }}
            >
              <Phone size={14} className="text-[#3B82F6] shrink-0" />
              <span className="font-medium" dir="ltr">{business.phone}</span>
            </a>
          )}

          {/* WhatsApp — clickable */}
          {business.whatsapp && (
            <a
              href={`https://wa.me/${business.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200"
              style={{
                background: "#F0FDF4",
                border:     "1px solid #BBF7D0",
                color:      "#15803D",
                boxShadow:  "0 1px 4px rgba(34,197,94,0.08)",
              }}
            >
              <MessageCircle size={14} className="text-[#22C55E] shrink-0" />
              <span>تواصل عبر واتساب</span>
            </a>
          )}

        </div>
      </div>
    </div>
  );
}
