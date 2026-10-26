import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";

// The page is a client component, so its title lives here. Without one it
// showed the site's home title, and could not be told apart from the
// customer sign-in (/account-login) in a tab or a search result.
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "Business sign in" : "دخول أصحاب الأعمال",
    description: en ? "Sign in to your business dashboard on Maw3ed." : "ادخل على لوحة تحكم نشاطك في موعد.",
    robots: { index: false, follow: true },
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
