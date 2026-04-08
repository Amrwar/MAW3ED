"use client";

import { type DashboardBookingStatus, STATUS_CONFIG } from "./types";
import { useLanguage } from "@/contexts/LanguageContext";

interface StatusBadgeProps {
  status: DashboardBookingStatus;
  size?:  "sm" | "md";
}

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { t } = useLanguage();
  const config  = STATUS_CONFIG[status];
  const label   = (t.dashboard.bookingStatus as Record<string, string>)[status] ?? config.label;

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ${
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
      } ${config.className}`}
    >
      {label}
    </span>
  );
}
