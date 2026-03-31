import Image from "next/image";
import Link from "next/link";
import { MapPin, CheckCircle, Clock } from "lucide-react";
import type { Business } from "@/types/business";
import StarRating from "./StarRating";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface BusinessCardProps {
  business: Business;
  className?: string;
  variant?: "default" | "compact";
}

export default function BusinessCard({
  business,
  className,
  variant = "default",
}: BusinessCardProps) {
  return (
    <Link
      href={`/company/${business.slug}`}
      className={cn(
        "card card-hover group block overflow-hidden rounded-xl transition-all duration-200",
        className
      )}
    >
      {/* Cover Image */}
      <div className="relative overflow-hidden h-44">
        <Image
          src={business.coverImage}
          alt={business.nameAr}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Badges overlay */}
        <div className="absolute top-3 start-3 flex flex-wrap gap-1.5">
          {business.isVerified && (
            <span className="flex items-center gap-1 text-xs font-semibold bg-white/95 text-[var(--color-brand)] px-2 py-0.5 rounded-full shadow-sm">
              <CheckCircle size={11} className="text-green-500" />
              موثّق
            </span>
          )}
          {business.isFeatured && (
            <span className="text-xs font-semibold bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full shadow-sm">
              مميز
            </span>
          )}
        </div>
        {/* Open status */}
        <div className="absolute top-3 end-3">
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm",
              business.isOpen
                ? "bg-green-50 text-green-600"
                : "bg-gray-100 text-gray-500"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                business.isOpen ? "bg-green-500" : "bg-gray-400"
              )}
            />
            {business.isOpen ? "مفتوح" : "مغلق"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        <p className="text-xs text-[var(--color-text-muted)] font-medium mb-1">
          {business.category}
        </p>

        {/* Name */}
        <h3 className="font-bold text-[var(--color-text-primary)] text-base leading-snug mb-1 group-hover:text-[var(--color-accent)] transition-colors">
          {business.nameAr}
        </h3>

        {/* Tagline */}
        {variant === "default" && (
          <p className="text-sm text-[var(--color-text-muted)] line-clamp-1 mb-3">
            {business.taglineAr}
          </p>
        )}

        {/* Rating */}
        <div className="flex items-center justify-between">
          <StarRating
            rating={business.rating}
            reviewCount={business.reviewCount}
            size="sm"
          />
          {/* Price range */}
          {business.minPrice && (
            <span className="text-xs text-[var(--color-text-muted)]">
              من {business.minPrice} ج
            </span>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 mt-2.5 text-xs text-[var(--color-text-muted)]">
          <MapPin size={12} />
          <span>{business.locationAr}</span>
        </div>

        {/* Tags */}
        {business.tags && business.tags.length > 0 && variant === "default" && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {business.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="default" className="text-xs py-0.5">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
