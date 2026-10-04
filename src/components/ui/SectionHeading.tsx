import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  align = "start",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  align?: "start" | "center";
  className?: string;
}) {
  const centred = align === "center";

  return (
    <div
      className={cn(
        "flex gap-6 mb-8",
        centred
          ? "flex-col items-center text-center"
          : "flex-wrap items-end justify-between",
        className,
      )}
    >
      <div className={cn("min-w-0", centred && "flex flex-col items-center")}>
        {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
        <h2 className={cn("section-title", eyebrow && "mt-2.5")}>{title}</h2>
        {subtitle && (
          <p className={cn("section-subtitle mt-4", centred && "mx-auto")}>{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
