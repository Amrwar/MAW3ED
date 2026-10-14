import { useAuth } from "@/features/auth/AuthProvider";
import type { BusinessRole } from "./types";

/**
 * What the signed-in person may do on the business side, for showing and
 * hiding — never for deciding. The server checks every request again
 * (src/lib/business-access.ts); this only spares somebody a button that
 * would be refused.
 *
 * An owner may do everything. A staff member's list comes from the
 * server with their user object, re-read on every launch.
 */

export type BusinessAction =
  | "bookings.readAll"
  | "bookings.confirm"
  | "bookings.progress"
  | "bookings.cancel"
  | "bookings.reschedule"
  | "customers.read"
  | "staff.read"
  | "staff.manageAccess"
  | "services.read"
  | "profile.read"
  | "reports.read";

export function useBusinessAccess(): { role: BusinessRole; can: (action: BusinessAction) => boolean; staffMemberId: string | null } {
  const { user } = useAuth();
  if (user?.businessId) return { role: "OWNER", can: () => true, staffMemberId: null };
  const staff = user?.staff;
  const allowed = new Set(staff?.permissions ?? []);
  return {
    role: staff?.role ?? "PROVIDER",
    can: (action) => allowed.has(action),
    staffMemberId: staff?.staffMemberId ?? null,
  };
}
