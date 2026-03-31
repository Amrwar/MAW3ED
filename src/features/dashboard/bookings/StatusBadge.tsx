import { type DashboardBookingStatus, STATUS_CONFIG } from "./types";

interface StatusBadgeProps {
  status: DashboardBookingStatus;
  size?:  "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      } ${config.className}`}
    >
      {config.label}
    </span>
  );
}
