import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/features/home/HeroSection";
import TrustStats from "@/features/home/TrustStats";
import WhyJoin from "@/features/home/WhyJoin";
import CategoriesSection from "@/features/home/CategoriesSection";
import HowItWorks from "@/features/home/HowItWorks";
import DemoSection from "@/features/home/DemoSection";
import PricingPreview from "@/features/home/PricingPreview";
import Testimonials from "@/features/home/Testimonials";
import FAQ from "@/features/home/FAQ";
import FinalCTA from "@/features/home/FinalCTA";
import { SectionDivider } from "@/components/ui/SectionDivider";
import { getCategories } from "@/lib/data";

export const metadata: Metadata = {
  title: "موعد | MAW3ED — احجز موعدك في ثوانٍ",
};

export default async function HomePage() {
  const categories = await getCategories();

  return (
    <>
      <Navbar />
      <main>

        {/* 1 ─ Hero (dark #0F172A) */}
        <HeroSection />

        {/* ▼ dark → light */}
        <SectionDivider variant="curve" from="#0F172A" to="#F8FAFC" />

        {/* 2 ─ Trust stats (light #F8FAFC) */}
        <TrustStats />

        {/* 3 ─ Why Maw3ed (light #F8FAFC) — same bg, no divider needed */}
        <WhyJoin />

        {/* 4 ─ Browse by Category (light #F8FAFC) — same bg, no divider */}
        <CategoriesSection categories={categories} />

        {/* ▼ light → dark */}
        <SectionDivider variant="curve" from="#F8FAFC" to="#0B1628" />

        {/* 5 ─ How It Works (dark #0B1628) */}
        <HowItWorks />

        {/* ▼ dark → dark (subtle blend between two close navy tones) */}
        <SectionDivider variant="glow" from="#0B1628" to="#0F172A" height={56} />

        {/* 6 ─ Demo / Booking preview (dark #0F172A) */}
        <DemoSection />

        {/* ▼ dark → light */}
        <SectionDivider variant="curve" from="#0F172A" to="#F8FAFC" />

        {/* 7 ─ Pricing preview (light #F8FAFC) */}
        <PricingPreview />

        {/* 8 ─ Testimonials (#FFFFFF) — very close to F8FAFC, no divider */}
        <Testimonials />

        {/* 9 ─ FAQ (light #F8FAFC) — same family, no divider */}
        <FAQ />

        {/* ▼ light → dark */}
        <SectionDivider variant="curve" from="#F8FAFC" to="#0F172A" />

        {/* 10 ─ Final CTA (dark #0F172A) */}
        <FinalCTA />

      </main>
      <Footer />
    </>
  );
}
