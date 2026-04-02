import type { MetadataRoute } from "next";

const BASE_URL = (process.env.AUTH_URL ?? "https://maw3ed.net").replace(/\/$/, "");

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
