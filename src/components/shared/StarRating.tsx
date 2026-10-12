import { cn } from "@/lib/utils";
import Stars from "@/components/shared/Stars";
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

  const textSize =
    size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base";

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="img"
      aria-label={`${fmtRating(rating)} / 5`}
    >
      <Stars value={rating} size={starSize} />

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
