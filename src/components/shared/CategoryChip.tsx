import Link from "next/link";
import type { Category } from "@/types/business";
import { cn } from "@/lib/utils";

interface CategoryChipProps {
  category: Category;
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export default function CategoryChip({
  category,
  active = false,
  size = "md",
  className,
}: CategoryChipProps) {
  return (
    <Link
      href={`/?category=${category.slug}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-medium transition-all duration-150 whitespace-nowrap",
        size === "md" && "px-4 py-2 text-sm",
        size === "sm" && "px-3 py-1.5 text-xs",
        active
          ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
          : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
        className
      )}
      style={
        active
          ? undefined
          : { "--hover-bg": category.bgColor } as React.CSSProperties
      }
    >
      <span>{category.icon}</span>
      <span>{category.nameAr}</span>
    </Link>
  );
}
