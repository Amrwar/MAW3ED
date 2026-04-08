import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/features/home/HeroSection";
import TrustStats from "@/features/home/TrustStats";
import CategoriesSection from "@/features/home/CategoriesSection";
import FeaturedBusinesses from "@/features/home/FeaturedBusinesses";
import HowItWorks from "@/features/home/HowItWorks";
import WhyJoin from "@/features/home/WhyJoin";
import DemoSection from "@/features/home/DemoSection";
import PricingPreview from "@/features/home/PricingPreview";
import Testimonials from "@/features/home/Testimonials";
import FinalCTA from "@/features/home/FinalCTA";
import { getCategories, getCities, getPublishedBusinesses } from "@/lib/data";

export const metadata: Metadata = {
  title: "موعد | MAW3ED — احجز موعدك في ثوانٍ",
};

export default async function HomePage() {
  const [categories, cities, featured] = await Promise.all([
    getCategories(),
    getCities(),
    getPublishedBusinesses({ take: 6 }),
  ]);

  return (
    <>
      <Navbar />
      <main>
        {/* 1. Hero + search */}
        <HeroSection categories={categories} cities={cities} />
        {/* 2. Trust stats */}
        <TrustStats />
        {/* 3. Browse by category */}
        <CategoriesSection categories={categories} />
        {/* 4. Featured businesses */}
        <FeaturedBusinesses businesses={featured} />
        {/* 5. How it works */}
        <HowItWorks />
        {/* 6. Why Maw3ed (for businesses) */}
        <WhyJoin />
        {/* 7. Product demo */}
        <DemoSection />
        {/* 8. Pricing preview */}
        <PricingPreview />
        {/* 9. Testimonials */}
        <Testimonials />
        {/* 10. Final CTA */}
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
