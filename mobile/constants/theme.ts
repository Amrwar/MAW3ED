/**
 * The design system, in one place.
 *
 * The colours are the web app's tokens, copied by value rather than
 * imported: the two codebases build separately and a shared CSS file
 * would have to be parsed at runtime. When a token changes on the web,
 * it changes here — the list below names its counterpart so the pair
 * can be found.
 *
 * What is NOT copied is the layout. The web's spacing scale assumes a
 * 1120px container; a phone is 390px wide and needs its own rhythm, its
 * own type scale, and touch targets the web never had to think about.
 * Shrinking the desktop design is how an app ends up feeling like a
 * website in a frame.
 */

/** Matches src/app/globals.css. Keep the two in step. */
export const colors = {
  // Surfaces
  surface: "#FFFFFF",
  surface2: "#F4F5F1",
  surface3: "#EFF1EC",
  ground: "#FAFAF7",

  // Text, on light
  ink: "#11201C",
  ink2: "#2C3B36",
  muted: "#566761",
  subtle: "#6A726C", // 4.5:1 on white — darkened for contrast
  faint: "#B6BEB9", // disabled and placeholders only, never body text
  inverse: "#FFFFFF",

  // Lines
  line: "#E7E8E2",
  line2: "#D8DCD6",

  // Brand
  // Matches the web token (globals.css): #0E7F5E measured 4.36:1 against
  // jade-soft; this clears 4.5:1 and looks the same.
  jade: "#0D7A5A",
  jadeHover: "#0A5F47",
  jadeSoft: "#E9F2EE",
  jadeLine: "#CFE3DB",
  jadeTint: "#F4F9F7",

  // The dark family the app opens and closes on
  night: "#11201C",
  night2: "#19302A",
  nightLine: "#27403A",
  nightText: "#A9BAB3",
  nightSubtle: "#7F9C92",
  nightAccent: "#4FA98B",

  // Status
  ok: "#0A5F47",
  okSoft: "#E9F2EE",
  warn: "#8A6514",
  warnSoft: "#FDF3E0",
  info: "#1B4E7A",
  infoSoft: "#E6EFF7",
  danger: "#9E3B2E",
  dangerSoft: "#FBEDEA",
  star: "#D9A441",
} as const;

/**
 * A 4pt scale. Tighter than the web's, because a phone has less room
 * and the same 80px section padding would leave nothing for content.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Sized for a phone held at arm's length, not for a monitor.
 * `lineHeight` is generous because Arabic needs the room: diacritics
 * sit above the line and clip at the tight leading that suits Latin.
 */
export const typography = {
  display: { fontSize: 30, lineHeight: 42, fontWeight: "800" },
  title: { fontSize: 22, lineHeight: 32, fontWeight: "800" },
  heading: { fontSize: 18, lineHeight: 27, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 26, fontWeight: "400" },
  bodyBold: { fontSize: 16, lineHeight: 26, fontWeight: "700" },
  label: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 20, fontWeight: "400" },
  tiny: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
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
 * iOS and Android express elevation differently, so each shadow gives
 * both: the iOS shadow* properties and an Android elevation. Using one
 * without the other means a card that floats on one platform and sits
 * flat on the other.
 */
export const shadows = {
  card: {
    shadowColor: "#11201C",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  raised: {
    shadowColor: "#11201C",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  float: {
    shadowColor: "#11201C",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/**
 * The minimum anything tappable may be.
 *
 * 44 is Apple's floor and Android's is 48; taking the larger means one
 * number that satisfies both, and nothing in the app is ever harder to
 * hit on one platform than the other.
 */
export const touchTarget = 48;

export const theme = {
  colors,
  spacing,
  typography,
  radius,
  shadows,
  iconSize,
  touchTarget,
} as const;

export type Theme = typeof theme;
