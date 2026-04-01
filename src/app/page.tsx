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
        <HeroSection categories={categories} cities={cities} />
        <TrustStats />
        <CategoriesSection categories={categories} />
        <FeaturedBusinesses businesses={featured} />
        <HowItWorks />
        <WhyJoin />
        <DemoSection />
        <Testimonials />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
