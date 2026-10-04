"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** A chip standing for an applied filter — shows a clear affordance. */
  applied?: boolean;
  onClear?: () => void;
}

export default function Chip({
  active = false,
  applied = false,
  onClear,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active || applied}
      className={cn(
        "chip",
        active && "chip-active",
        applied && "chip-jade",
        className,
      )}
      {...props}
    >
      {children}
      {applied && onClear && (
        <X
          aria-hidden="true"
          className="h-3 w-3"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        />
      )}
    </button>
  );
}
