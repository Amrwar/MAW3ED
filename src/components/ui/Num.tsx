import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Wraps a numeric run so it stays left-to-right and uses tabular
 * figures inside otherwise right-to-left Arabic copy.
 */
export default function Num({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("num", className)}>{children}</span>;
}
