import type { ReactNode } from "react";
import { BookingCard as Card } from "@/design";
import { statusLabel, statusTone } from "@/features/bookings/status";

/**
 * A booking, for either side — the customer's list and the owner's day.
 * The design system draws it; this only maps a booking's status onto
 * the label and tone the product uses for it (features/bookings/status.ts,
 * mirrored from the web).
 */
export function BookingCard({
  status,
  meta,
  ...rest
}: {
  title: string;
  subtitle?: string | null;
  date: string;
  startTime: string;
  endTime?: string;
  status: string;
  price?: number | null;
  currency?: string;
  minutesUntil?: number;
  meta?: string | null;
  actions?: ReactNode;
  onPress?: () => void;
}) {
  return <Card {...rest} meta={[meta]} status={{ label: statusLabel(status), tone: statusTone(status) }} />;
}
