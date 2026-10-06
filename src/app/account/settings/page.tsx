import type { Metadata } from "next";
import { getAccountUser } from "@/lib/account/queries";
import SettingsForm from "../_components/SettingsForm";

export const metadata: Metadata = { title: "الإعدادات", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const user = await getAccountUser();
  if (!user) return null;

  return <SettingsForm user={user} />;
}
