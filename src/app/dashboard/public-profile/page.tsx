import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "صفحتك العامة" };

/**
 * The public profile is edited in the settings screen's profile tab and
 * previewed in its preview tab. The nav entry opens that, rather than a
 * second editor that would have to be kept in step with it.
 */
export default function PublicProfilePage() {
  redirect("/dashboard/settings?tab=profile");
}
