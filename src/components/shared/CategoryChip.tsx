import Link from "@/components/shared/LocaleLink";
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
      href={`/categories/${category.slug}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "chip",
        size === "sm" && "px-3 py-2 text-xs",
        active && "chip-active",
        className,
      )}
    >
      {category.nameAr}
    </Link>
  );
}
