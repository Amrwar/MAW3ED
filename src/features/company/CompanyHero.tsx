import Image from "next/image";
import { MapPin, Phone, CheckCircle, Clock, Share2, Heart } from "lucide-react";
import type { Business } from "@/types/business";
import StarRating from "@/components/shared/StarRating";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

interface CompanyHeroProps {
  business: Business;
}

export default function CompanyHero({ business }: CompanyHeroProps) {
  return (
    <div>
      {/* Cover image */}
      <div className="relative h-56 md:h-72 w-full overflow-hidden bg-gray-100">
        <Image
          src={business.coverImage}
          alt={business.nameAr}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Actions top right */}
        <div className="absolute top-4 end-4 flex gap-2">
          <button className="w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow transition-colors">
            <Share2 size={15} className="text-gray-700" />
          </button>
          <button className="w-9 h-9 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow transition-colors">
            <Heart size={15} className="text-gray-700" />
          </button>
        </div>
      </div>

      {/* Business info */}
      <div className="container-app">
        <div className="relative -mt-12 md:-mt-16 pb-6 border-b border-[var(--color-border)]">
          <div className="flex flex-col md:flex-row md:items-end gap-5">
            {/* Logo / Avatar */}
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white border-2 border-white shadow-lg overflow-hidden shrink-0 flex items-center justify-center">
              {business.logoImage ? (
                <Image
                  src={business.logoImage}
                  alt={business.nameAr}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[var(--color-surface-2)] flex items-center justify-center text-3xl font-black text-[var(--color-brand)]">
                  {business.nameAr[0]}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 md:pb-2">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {business.isVerified && (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle size={11} />
                    موثّق
                  </Badge>
                )}
                <Badge variant="default">{business.category}</Badge>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                    business.isOpen
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      business.isOpen ? "bg-green-500 animate-pulse" : "bg-gray-400"
                    }`}
                  />
                  {business.isOpen ? "مفتوح الآن" : "مغلق حاليًا"}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-[var(--color-text-primary)] mb-1">
                {business.nameAr}
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm mb-3">
                {business.taglineAr}
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <StarRating
                  rating={business.rating}
                  reviewCount={business.reviewCount}
                  size="md"
                />
                <div className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                  <MapPin size={14} />
                  <span>{business.locationAr}</span>
                </div>
                {business.minPrice && (
                  <div className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                    <span>من {business.minPrice} إلى {business.maxPrice} ج.م</span>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex gap-2 pb-2">
              {business.phone && (
                <Button variant="outline" size="sm">
                  <Phone size={15} />
                  اتصل
                </Button>
              )}
              <Button variant="accent" size="md">
                احجز موعد
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
