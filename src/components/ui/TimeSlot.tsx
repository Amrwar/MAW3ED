"use client";

import { cn } from "@/lib/utils";
import { clock } from "@/lib/fmt";

export default function TimeSlot({
  time,
  selected = false,
  disabled = false,
  onSelect,
  className,
}: {
  time: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: (time: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={() => onSelect?.(time)}
      className={cn("slot", selected && "slot-selected", className)}
    >
      {clock(time)}
    </button>
  );
}
