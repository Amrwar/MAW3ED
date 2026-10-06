import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "الفواتير والاشتراك" };

/**
 * Billing lives in the settings screen's subscription tab, where it has
 * always been. Rather than build a second copy that would drift from
 * it, the nav entry opens the real one.
 */
export default function BillingPage() {
  redirect("/dashboard/settings?tab=subscription");
}
