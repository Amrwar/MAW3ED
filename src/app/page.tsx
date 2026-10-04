import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/features/home/HeroSection";
import TrustStats from "@/features/home/TrustStats";
import CategoriesSection from "@/features/home/CategoriesSection";
import HowItWorks from "@/features/home/HowItWorks";
import WhyJoin from "@/features/home/WhyJoin";
import PricingPreview from "@/features/home/PricingPreview";
import Testimonials from "@/features/home/Testimonials";
import FAQ from "@/features/home/FAQ";
import FinalCTA from "@/features/home/FinalCTA";
import { getCategories } from "@/lib/data";

export const metadata: Metadata = {
  title: "موعد | MAW3ED — احجز موعدك في ثوانٍ",
};

/**
 * One continuous light page with a single dark band near the end.
 * The old build alternated dark and light every section and needed
 * SVG dividers to bridge them; the page reads as one surface now, so
 * those dividers are gone.
 */
export default async function HomePage() {
  const categories = await getCategories();

  return (
    <>
      <Navbar />
      <main>
        {/* 1 — Search and the next free slots */}
        <HeroSection />

        {/* 2 — Who already uses it */}
        <TrustStats />

        {/* 3 — Browse by category */}
        <CategoriesSection categories={categories} />

        {/* 4 — Three steps to a booking */}
        <HowItWorks />

        {/* 5 — The one dark band: the pitch to business owners */}
        <WhyJoin />

        {/* 6 — Plans */}
        <PricingPreview />

        {/* 7 — Proof */}
        <Testimonials />

        {/* 8 — Objections */}
        <FAQ />

        {/* 9 — Close */}
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
