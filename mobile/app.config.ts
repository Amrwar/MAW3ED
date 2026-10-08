import type { ExpoConfig, ConfigContext } from "expo/config";

/**
 * The native app's identity and capabilities.
 *
 * A function rather than a static app.json so the environment can
 * decide what gets built: a development build points at a laptop, a
 * preview build at staging, production at maw3ed.net. Nothing secret
 * lives here — everything in `extra` ships inside the binary and can be
 * read by anyone who downloads it, so it holds only the API's address
 * and things already public.
 *
 * APP_ENV is set by the EAS build profile (see eas.json) and defaults
 * to development so a bare `expo start` works without ceremony.
 */

type AppEnv = "development" | "staging" | "production";

const APP_ENV = (process.env.APP_ENV ?? "development") as AppEnv;

const API_URL: Record<AppEnv, string> = {
  // A phone cannot reach "localhost" — that is the phone itself. Set
  // EXPO_PUBLIC_API_URL to the machine's LAN address (or a tunnel) when
  // running against a local server.
  development: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  staging: process.env.EXPO_PUBLIC_API_URL ?? "https://maw-3-ed.vercel.app",
  production: "https://www.maw3ed.net",
};

const NAME: Record<AppEnv, string> = {
  development: "موعد Dev",
  staging: "موعد Staging",
  production: "موعد",
};

/**
 * A distinct id per environment, so a tester can hold the production
 * app and a staging build on one phone without one replacing the other.
 */
const BUNDLE_ID: Record<AppEnv, string> = {
  development: "net.maw3ed.app.dev",
  staging: "net.maw3ed.app.staging",
  production: "net.maw3ed.app",
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME[APP_ENV],
  slug: "maw3ed",
  scheme: "maw3ed",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  // The new architecture is the only one in SDK 57; the opt-in flag
  // it used to need is gone.

  // Arabic first, which is what the product is. expo-localization reads
  // the device at runtime; this is the fallback when it cannot.
  locales: {
    ar: "./locales/ar.json",
    en: "./locales/en.json",
  },

  icon: "./assets/icon.png",

  ios: {
    bundleIdentifier: BUNDLE_ID[APP_ENV],
    supportsTablet: true,
    infoPlist: {
      // Arabic needs right-to-left; without this iOS lays the app out
      // left-to-right however the device is set.
      CFBundleAllowMixedLocalizations: true,
      // Push on iOS needs the entitlement, which EAS adds from this.
      UIBackgroundModes: ["remote-notification"],
    },
    associatedDomains: [
      // Universal links: tapping a maw3ed.net booking link opens the
      // app rather than Safari. Requires apple-app-site-association to
      // be served from the site — see docs/mobile.md.
      "applinks:www.maw3ed.net",
      "applinks:maw3ed.net",
    ],
  },

  android: {
    package: BUNDLE_ID[APP_ENV],
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#11201C",
    },
    permissions: [
      "android.permission.INTERNET",
      "android.permission.POST_NOTIFICATIONS",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "www.maw3ed.net", pathPrefix: "/company" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "www.maw3ed.net", pathPrefix: "/booking" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      // RTL is set natively at build time, not at runtime.
      //
      // The app's copy is Arabic throughout, so the layout direction is
      // a property of the product, not of the phone: an Egyptian user
      // whose device is set to English still needs the Arabic layout.
      //
      // It is configured here rather than with I18nManager.forceRTL
      // because that call only takes effect on the NEXT launch — the
      // very first run after install would lay out left-to-right with
      // Arabic text in it, which is the worst possible first
      // impression for an Arabic-first product. Setting it in the
      // build means the first frame is correct.
      "expo-localization",
      { supportsRTL: true, forcesRTL: true },
    ],
    [
      // The splash moved out of the top-level config and into this
      // plugin in SDK 57. Dark, so launching the app and the app itself
      // open on the same colour instead of flashing white first.
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#11201C",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#0E7F5E",
      },
    ],
  ],

  experiments: { typedRoutes: true },

  /**
   * Readable at runtime through expo-constants. Public by definition —
   * it is compiled into the binary — so it holds the API's address and
   * the environment's name, and never a key, a secret or a token.
   */
  extra: {
    appEnv: APP_ENV,
    apiUrl: API_URL[APP_ENV],
    eas: {
      // Filled in by `eas init`; left null so a fresh clone does not
      // look like it belongs to somebody else's project.
      projectId: process.env.EAS_PROJECT_ID ?? null,
    },
  },
});
