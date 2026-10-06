import type { Metadata } from "next";
import { getAccountUser } from "@/lib/account/queries";
import ProfileForm from "../_components/ProfileForm";

export const metadata: Metadata = { title: "بياناتي", robots: { index: false, follow: false } };

export default async function ProfilePage() {
  const user = await getAccountUser();
  if (!user) return null;

  return <ProfileForm user={user} />;
}
