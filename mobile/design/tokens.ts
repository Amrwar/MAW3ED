/**
 * Maw3ed's design tokens, for the app.
 *
 * The colours are the web's (src/app/globals.css), copied by value: the
 * two codebases build separately and a shared CSS file would have to be
 * parsed at runtime. When a token changes on the web it changes here,
 * and design/tokens.test.ts checks the pairs that must stay readable.
 *
 * What is NOT copied is the layout. The web's scale assumes a 1120px
 * container; a phone is 390px wide, is held in one hand and read at
 * arm's length. The app has its own rhythm, type scale and touch
 * targets — it should feel like Maw3ed, not like the website in a frame.
 *
 * Deep Anchor, the web's direction, carries over as a rule rather than
 * a layout: `night` is the anchor — the app opens on it (splash, sign-in)
 * and frames with it (headers on dark screens) — light `ground` is where
 * content lives, white `surface` cards are the bright things on it, and
 * jade is the one accent, used for what can be tapped or what is chosen.
 */

/* ─── Colour ─────────────────────────────────────────────── */

/** The palette. Matches src/app/globals.css — keep the two in step. */
export const colors = {
  // Surfaces. Ground is warm sand — the app's own (Bold Cairo), not the web's.
  ground: "#F8F5EC",
  surface: "#FFFFFF",
  surface2: "#F4F5F1",
  surface3: "#EFF1EC",

  // Text on light
  ink: "#11201C",
  ink2: "#2C3B36",
  muted: "#566761",
  subtle: "#6A726C", // 4.5:1 on white — the lightest colour real text may use
  faint: "#B6BEB9", // disabled and placeholders only, never text that must be read
  inverse: "#FFFFFF",

  // Lines
  line: "#E7E8E2",
  line2: "#D8DCD6",

  // Jade — the single brand accent. #0E7F5E was 4.36:1 on jadeSoft; this clears 4.5.
  jade: "#0D7A5A",
  jadeHover: "#0A5F47",
  jadeSoft: "#E9F2EE",
  jadeLine: "#CFE3DB",
  jadeTint: "#F4F9F7",

  // Night — the anchor. In the app it is Cairo green (the redesign's
  // "Bold Cairo"), deeper and greener than the web's near-black.
  night: "#0B3A2E",
  night2: "#0F4537",
  nightLine: "#2D5A4D",
  nightText: "#B9CBC4",
  nightSubtle: "#8FAAA0",
  nightAccent: "#D9B45A", // gold: icons and highlights on night

  // Gold — the second accent, only ever on night or as a fill under night text.
  gold: "#D9B45A",
  goldSoft: "#F5ECD3",
  goldLine: "#E6D3A1",

  // The drawn street plan on the map-first ways in (features/location/MapArt.tsx).
  mapLand: "#E4E9DF",
  mapWater: "#C9DCE8",
  mapPark: "#CFE2C7",

  // Status — independent of the brand hue
  ok: "#0A5F47",
  okSoft: "#E9F2EE",
  okLine: "#CFE3DB",
  warn: "#8A6514",
  warnSoft: "#FDF3E0",
  warnLine: "#F0E3C6",
  info: "#1B4E7A",
  infoSoft: "#E6EFF7",
  infoLine: "#CFDEEC",
  danger: "#9E3B2E",
  dangerSoft: "#FBEDEA",
  dangerLine: "#E8D5D1",
  star: "#D9A441",

  /** Behind sheets and dialogs. night at 45%, as the web's overlay. */
  scrim: "rgba(17, 32, 28, 0.45)",
} as const;

export type ColorName = keyof typeof colors;

/**
 * Tones a component may be in. Each names the three colours it needs —
 * text, a soft fill, a line — so a badge, a chip and an alert agree on
 * what "warning" looks like without each picking its own.
 */
export const tones = {
  neutral: { fg: colors.muted, bg: colors.surface2, line: colors.line },
  jade: { fg: colors.jade, bg: colors.jadeSoft, line: colors.jadeLine },
  ok: { fg: colors.ok, bg: colors.okSoft, line: colors.okLine },
  warn: { fg: colors.warn, bg: colors.warnSoft, line: colors.warnLine },
  info: { fg: colors.info, bg: colors.infoSoft, line: colors.infoLine },
  danger: { fg: colors.danger, bg: colors.dangerSoft, line: colors.dangerLine },
} as const;

export type Tone = keyof typeof tones;

/* ─── Type ───────────────────────────────────────────────── */

/**
 * Readex Pro: one family drawn for Arabic and Latin together, so a mixed
 * line does not change typeface mid-word. Rounder and more confident
 * than the web's Almarai — the app's own voice (Bold Cairo). Loaded in
 * app/_layout.tsx before the first screen draws.
 */
export const fonts = {
  light: "ReadexPro_300Light",
  regular: "ReadexPro_400Regular",
  bold: "ReadexPro_600SemiBold",
  extraBold: "ReadexPro_700Bold",
} as const;

/**
 * Sized for a phone held at arm's length. Line heights are generous
 * because Arabic needs the room: diacritics sit above the line and clip
 * at the tight leading that suits Latin.
 *
 * Weight is carried by the font family, not fontWeight — Android picks
 * a synthetic bold when given fontWeight on a custom font.
 */
export const typography = {
  display: { fontSize: 30, lineHeight: 42, fontFamily: fonts.extraBold },
  title: { fontSize: 22, lineHeight: 32, fontFamily: fonts.extraBold },
  heading: { fontSize: 18, lineHeight: 28, fontFamily: fonts.bold },
  body: { fontSize: 16, lineHeight: 26, fontFamily: fonts.regular },
  bodyBold: { fontSize: 16, lineHeight: 26, fontFamily: fonts.bold },
  label: { fontSize: 14, lineHeight: 22, fontFamily: fonts.bold },
  caption: { fontSize: 13, lineHeight: 20, fontFamily: fonts.regular },
  tiny: { fontSize: 12, lineHeight: 18, fontFamily: fonts.bold },
} as const;

export type TypeVariant = keyof typeof typography;

/**
 * How far system text scaling may grow each size. Large-text users get
 * real enlargement; the cap stops a 30pt display line becoming 90pt and
 * pushing every other line off the screen.
 */
export const maxFontScale: Record<TypeVariant, number> = {
  display: 1.4,
  title: 1.5,
  heading: 1.7,
  body: 2,
  bodyBold: 2,
  label: 1.8,
  caption: 1.8,
  tiny: 1.6,
};

/* ─── Space, shape, depth ────────────────────────────────── */

/** A 4pt scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Matches the web's --radius-* scale. */
export const radius = {
  xs: 6,
  sm: 8,
  md: 13,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

/**
 * Each level gives both the iOS shadow and the Android elevation — one
 * without the other is a card that floats on one platform and sits flat
 * on the other.
 */
export const elevation = {
  none: {},
  card: {
    shadowColor: colors.night,
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  raised: {
    shadowColor: colors.night,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  float: {
    shadowColor: colors.night,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const;

/** Kept for the screens written before `elevation` had a name. */
export const shadows = elevation;

export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32 } as const;

/**
 * The smallest anything tappable may be. Apple's floor is 44, Android's
 * 48; one number that satisfies both means nothing is harder to hit on
 * one platform than the other.
 */
export const touchTarget = 48;

/**
 * Left to right whatever the language — phone numbers, codes, a photo
 * strip. Applied inline, never inside StyleSheet.create: react-native-web
 * validates those and rejects `direction` (it is still a valid style on
 * both native platforms and in CSS, so inline it works everywhere).
 */
export const ltr = { direction: "ltr" } as const;

/** Durations, so things that move together move at the same pace. */
export const motion = {
  fast: 120,
  normal: 220,
  slow: 320,
} as const;

/**
 * Widths at which the layout changes. One component adapts across them
 * (see design/layout.ts); nothing is built twice for different sizes.
 */
export const breakpoints = {
  /** Small tablets and large phones in landscape. */
  tablet: 600,
  /** Large tablets. */
  wide: 900,
} as const;

/** Content never grows wider than this, however wide the screen. */
export const maxContentWidth = 720;

export const theme = {
  colors,
  tones,
  fonts,
  typography,
  maxFontScale,
  spacing,
  radius,
  elevation,
  iconSize,
  touchTarget,
  motion,
  breakpoints,
  maxContentWidth,
} as const;

export type Theme = typeof theme;
