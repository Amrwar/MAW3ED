"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import ManualBookingPanel, { type ServiceOption } from "./ManualBookingPanel";
import type { DashboardBooking } from "@/features/dashboard/bookings/types";

type Props = {
  services:   ServiceOption[];
  slug:       string;
  onCreated?: (booking: DashboardBooking) => void;
  className?: string;
  style?:     React.CSSProperties;
  label?:     string;
};

export default function NewBookingButton({
  services,
  slug,
  onCreated,
  className = "btn btn-primary gap-2",
  style,
  label = "حجز جديد",
}: Props) {
  const [open, setOpen] = useState(false);

  function handleCreated(booking: DashboardBooking) {
    onCreated?.(booking);
    // Panel stays open to show success screen — it will close itself
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={className} style={style}>
        <Plus size={16} />
        {label}
      </button>

      <ManualBookingPanel
        open={open}
        onClose={() => setOpen(false)}
        slug={slug}
        services={services}
        onCreated={handleCreated}
      />
    </>
  );
}
