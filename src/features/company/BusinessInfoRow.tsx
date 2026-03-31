import { MapPin, Clock, Phone, Globe, MessageCircle } from "lucide-react";
import type { Business } from "@/types/business";

interface BusinessInfoRowProps {
  business: Business;
}

const dayNames: Record<string, string> = {
  Sunday: "الأحد",
  Monday: "الاثنين",
  Tuesday: "الثلاثاء",
  Wednesday: "الأربعاء",
  Thursday: "الخميس",
  Friday: "الجمعة",
  Saturday: "السبت",
};

export default function BusinessInfoRow({ business }: BusinessInfoRowProps) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayHours = business.hours?.find((h) => h.day === today);

  return (
    <div className="border-b border-[var(--color-border)]">
      <div className="container-app py-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          {/* Address */}
          {business.address && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center shrink-0">
                <MapPin size={16} className="text-[var(--color-accent)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">العنوان</p>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {business.address}
                </p>
              </div>
            </div>
          )}

          {/* Hours */}
          {todayHours && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center shrink-0">
                <Clock size={16} className="text-[var(--color-accent)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">اليوم</p>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {todayHours.closed
                    ? "مغلق"
                    : `${todayHours.open} – ${todayHours.close}`}
                </p>
              </div>
            </div>
          )}

          {/* Phone */}
          {business.phone && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center shrink-0">
                <Phone size={16} className="text-[var(--color-accent)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">تليفون</p>
                <a
                  href={`tel:${business.phone}`}
                  className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
                  dir="ltr"
                >
                  {business.phone}
                </a>
              </div>
            </div>
          )}

          {/* WhatsApp */}
          {business.whatsapp && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                <MessageCircle size={16} className="text-green-500" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">واتساب</p>
                <a
                  href={`https://wa.me/${business.whatsapp?.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
                >
                  تواصل عبر واتساب
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
