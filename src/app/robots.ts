import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

const BASE_URL = siteUrl;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/businesses",
        "/company/",
        "/cities/",
        "/categories/",
      ],
      disallow: [
        "/dashboard/",
        "/api/",
        "/onboarding/",
        "/login",
        "/signup",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
