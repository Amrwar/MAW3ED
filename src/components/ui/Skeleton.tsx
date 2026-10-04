import { cn } from "@/lib/utils";

export default function Skeleton({
  className,
  rounded = "sm",
}: {
  className?: string;
  rounded?: "sm" | "md" | "lg" | "full";
}) {
  const r = {
    sm: "rounded-[var(--radius-sm)]",
    md: "rounded-[var(--radius-md)]",
    lg: "rounded-[var(--radius-lg)]",
    full: "rounded-full",
  }[rounded];

  return <span aria-hidden="true" className={cn("skeleton block", r, className)} />;
}
