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
        {/* 1. Hero */}
        <HeroSection />
        {/* 2. Trust stats + business type strip */}
        <TrustStats />
        {/* 3. Features / Why join */}
        <WhyJoin />
        {/* 4. Browse by category */}
        <CategoriesSection categories={categories} />
        {/* 5. How it works */}
        <HowItWorks />
        {/* 6. Booking experience preview */}
        <DemoSection />
        {/* 7. Pricing preview */}
        <PricingPreview />
        {/* 8. Testimonials */}
        <Testimonials />
        {/* 9. FAQ */}
        <FAQ />
        {/* 10. Final CTA */}
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
