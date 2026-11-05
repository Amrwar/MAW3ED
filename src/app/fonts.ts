import { Almarai, Instrument_Sans, Newsreader } from "next/font/google";

/**
 * The three brand faces, self-hosted.
 *
 * They used to come from an @import of fonts.googleapis.com in
 * globals.css, which the Content-Security-Policy (style-src and
 * font-src 'self', lib/security/csp.ts) blocks, so no page ever had
 * them: everything fell back to system fonts. next/font downloads the
 * files at build time and serves them from this origin, which the
 * policy allows as it stands.
 *
 * Each exposes a CSS variable that globals.css feeds into the design
 * tokens (--font-arabic, --font-latin, --font-display); the root layout
 * puts the classes on <html> so the variables exist where the tokens
 * are resolved.
 */
export const almarai = Almarai({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "700", "800"],
  display: "swap",
  variable: "--font-almarai",
});

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-instrument-sans",
});

export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-newsreader",
});

export const fontVariables = `${almarai.variable} ${instrumentSans.variable} ${newsreader.variable}`;
