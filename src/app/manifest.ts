import type { MetadataRoute } from "next";

/**
 * The web app manifest, served at /manifest.webmanifest and linked from
 * every page by Next.
 *
 * Arabic first, like the site: the name a phone puts under the icon is
 * the brand as customers say it. The old public/site.webmanifest had
 * empty names, a white theme and no link from any page, so no browser
 * ever offered to install the site.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "موعد · Maw3ed",
    short_name: "موعد",
    description: "احجز في عيادات وصالونات وجيمات ومراكز في مصر في ثواني، من غير مكالمات.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "ar",
    dir: "rtl",
    // The navbar's colour (--color-night); the background matches the
    // page ground so the splash screen does not flash white then cream.
    theme_color: "#11201C",
    background_color: "#FAFAF7",
    categories: ["lifestyle", "health", "business"],
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Padded onto a full square, so a launcher's circle or squircle
      // crop does not cut the mark.
      { src: "/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
