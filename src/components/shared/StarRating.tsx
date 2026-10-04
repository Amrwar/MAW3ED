import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { rating as fmtRating } from "@/lib/fmt";

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  showCount?: boolean;
}

const sizeMap = { sm: 12, md: 14, lg: 16 };

export default function StarRating({
  rating,
  reviewCount,
  size = "md",
  className,
  showCount = true,
}: StarRatingProps) {
  const starSize = sizeMap[size];
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;

  const textSize =
    size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base";

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="img"
      aria-label={`${fmtRating(rating)} / 5`}
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={starSize}
            className={cn(
              i < full
                ? "fill-[var(--color-star)] text-[var(--color-star)]"
                : i === full && hasHalf
                  ? "fill-[var(--color-star)]/40 text-[var(--color-star)]"
                  : "fill-[var(--color-line)] text-[var(--color-line)]",
            )}
          />
        ))}
      </span>

      <span className={cn("num font-bold text-[var(--color-ink)]", textSize)}>
        {fmtRating(rating)}
      </span>

      {/* A count of zero is hidden rather than rendered as an empty
          bracket, which is what the old card did. */}
      {showCount && !!reviewCount && (
        <span className={cn("num text-[var(--color-subtle)]", textSize)}>
          ({reviewCount})
        </span>
      )}
    </div>
  );
}
