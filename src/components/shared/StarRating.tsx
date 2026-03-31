import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showCount?: boolean;
}

const sizeMap = {
  sm: 12,
  md: 14,
  lg: 16,
};

export default function StarRating({
  rating,
  reviewCount,
  size = "md",
  className,
  showCount = true,
}: StarRatingProps) {
  const starSize = sizeMap[size];
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={starSize}
            className={cn(
              i < fullStars
                ? "fill-amber-400 text-amber-400"
                : i === fullStars && hasHalf
                ? "fill-amber-200 text-amber-400"
                : "fill-gray-200 text-gray-200"
            )}
          />
        ))}
      </div>
      <span
        className={cn(
          "font-semibold text-[var(--color-text-primary)]",
          size === "sm" && "text-xs",
          size === "md" && "text-sm",
          size === "lg" && "text-base"
        )}
      >
        {rating.toFixed(1)}
      </span>
      {showCount && reviewCount !== undefined && (
        <span
          className={cn(
            "text-[var(--color-text-muted)]",
            size === "sm" && "text-xs",
            size === "md" && "text-sm",
            size === "lg" && "text-sm"
          )}
        >
          ({reviewCount.toLocaleString("ar-EG")})
        </span>
      )}
    </div>
  );
}
