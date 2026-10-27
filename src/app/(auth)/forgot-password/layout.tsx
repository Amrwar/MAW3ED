import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";

// The page is a client component, so its title lives here.
export async function generateMetadata(): Promise<Metadata> {
  const en = (await getLang()) === "en";
  return {
    title: en ? "Forgot your password" : "نسيت كلمة المرور",
    robots: { index: false, follow: true },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
