import type { Metadata } from "next";
import DemoClient from "./_components/DemoClient";

export const metadata: Metadata = {
  title: "جرّب لوحة التحكم — نسخة تجريبية",
  description: "نسخة تجريبية من لوحة تحكم موعد ببيانات وهمية. مفيش حاجة هنا بتتحفظ.",
};

/**
 * A try-before-you-sign-up dashboard, on invented data, entirely in
 * the browser. No session is read and nothing is fetched: see
 * lib/demo/workspace.ts for why it cannot touch a real business.
 */
export default function DemoPage() {
  return <DemoClient />;
}
