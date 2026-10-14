import type { ExpoConfig, ConfigContext } from "expo/config";
import { existsSync } from "node:fs";

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

const APP_ENVS = ["development", "staging", "production"] as const;
const APP_ENV = (process.env.APP_ENV ?? "development") as AppEnv;
if (!APP_ENVS.includes(APP_ENV)) {
  throw new Error(`APP_ENV must be one of ${APP_ENVS.join(", ")}; got "${APP_ENV}"`);
}

/**
 * Where the API is, per build — from the environment, never written
 * here. eas.json sets EXPO_PUBLIC_API_URL for the staging and production
 * profiles; for development, set it to the machine's LAN address (a
 * phone cannot reach "localhost" — that is the phone itself).
 *
 * A staging or production build without it stops here, at build time,
 * rather than shipping an app pointed at nowhere.
 */
function apiUrl(env: AppEnv): string {
  const url = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  if (env === "development") return "http://localhost:3000";
  throw new Error(`EXPO_PUBLIC_API_URL is required for a ${env} build (see eas.json)`);
}

function googleServicesFile(): string | undefined {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON?.trim();
  if (fromEnv) return fromEnv;
  return existsSync("./google-services.json") ? "./google-services.json" : undefined;
}

/**
 * The domain whose links open this build. Production only — see
 * ios.associatedDomains.
 *
 * www only. maw3ed.net redirects to www, and neither Apple nor Google
 * follows a redirect when fetching the verification files, so the bare
 * domain can never verify — and on Android 11 and older one unverified
 * host in a filter turns app links off for all of them. Every link the
 * system writes is www (src/lib/url.ts).
 */
/** expo.dev/@amrwar/maw3ed — set by `eas init`. */
const EAS_PROJECT_ID = "7f8e70ac-475d-4ce3-a89d-33f78ee86e8a";

const APP_LINK_HOSTS = APP_ENV === "production" ? ["www.maw3ed.net"] : [];

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
  owner: "amrwar",
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
    // iPhone only. No screen has been designed or tested at iPad sizes,
    // and an iPad-capable build is reviewed on an iPad — ship what we test.
    supportsTablet: false,
    infoPlist: {
      // Arabic needs right-to-left; without this iOS lays the app out
      // left-to-right however the device is set.
      CFBundleAllowMixedLocalizations: true,
      // No UIBackgroundModes: visible push needs only the aps-environment
      // entitlement, which the expo-notifications plugin adds. The
      // "remote-notification" mode is for silent/background pushes, which
      // the app never sends — and App Review asks why it is declared.
      // No encryption beyond HTTPS, so App Store Connect does not ask
      // the export-compliance question on every upload.
      ITSAppUsesNonExemptEncryption: false,
    },
    // Universal links: tapping a maw3ed.net link opens the app rather
    // than Safari. The site serves apple-app-site-association naming the
    // production bundle only (src/lib/app-links.ts), so only the
    // production build claims the domain — a staging build on a tester's
    // phone must not compete with the real app for customers' links.
    associatedDomains: APP_LINK_HOSTS.map((host) => `applinks:${host}`),
  },

  android: {
    package: BUNDLE_ID[APP_ENV],
    // Firebase config, needed for Android to issue a push token (FCM).
    // From an EAS file variable (GOOGLE_SERVICES_JSON) in cloud builds, or
    // a local google-services.json — never committed. Without it the app
    // builds and runs; push reports "not available" instead of crashing.
    // See docs/push-setup.md.
    ...(googleServicesFile() ? { googleServicesFile: googleServicesFile() } : {}),
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      // colors.night — the foreground is the cream wordmark on transparent.
      backgroundColor: "#0B3A2E",
    },
    permissions: [
      "android.permission.INTERNET",
      "android.permission.POST_NOTIFICATIONS",
      // "Near me" — foreground only, asked when the person taps it.
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
    ],
    // The React Native template adds these; the app reads no files and
    // draws over nothing, and Play review asks about every one.
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
      // Never tracked in the background.
      "android.permission.ACCESS_BACKGROUND_LOCATION",
    ],
    // Google Maps on Android needs a key in a store build (Expo Go has its
    // own). From the environment; never committed. See docs/location.md.
    ...(process.env.GOOGLE_MAPS_ANDROID_API_KEY
      ? { config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } } }
      : {}),
    // Android App Links, verified against /.well-known/assetlinks.json.
    // Production only, for the same reason as associatedDomains; the
    // paths match APP_LINK_PATHS in the web's src/lib/app-links.ts.
    intentFilters:
      APP_LINK_HOSTS.length === 0
        ? []
        : [
            {
              action: "VIEW",
              autoVerify: true,
              data: APP_LINK_HOSTS.flatMap((host) =>
                // With the slash, so /company-pricing or /bookings would not match.
                ["/company/", "/booking/"].map((pathPrefix) => ({ scheme: "https", host, pathPrefix })),
              ),
              category: ["BROWSABLE", "DEFAULT"],
            },
          ],
  },

  plugins: [
    "expo-router",
    // Tokens are stored without biometric gating, so no Face ID prompt
    // text is needed — leaving the default would ship a permission
    // string for something the app never asks for.
    ["expo-secure-store", { faceIDPermission: false }],
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
      //
      // The white wordmark: splash.png is dark ink on transparent, which
      // on this background was all but invisible — the app opened on a
      // blank dark screen. logo-white.png is the same artwork, recoloured.
      "expo-splash-screen",
      {
        image: "./assets/logo-white.png",
        imageWidth: 180,
        resizeMode: "contain",
        backgroundColor: "#11201C",
      },
    ],
    [
      // Foreground "when in use" only — the app never asks for "always".
      "expo-location",
      {
        locationWhenInUsePermission: "مواعيد بيستخدم موقعك لما تطلب الأماكن القريبة منك بس، ومبيحفظهوش.",
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#0D7A5A",
      },
    ],
    // Crash reports. The plugin uploads source maps and debug symbols at
    // build time, which needs SENTRY_ORG and SENTRY_AUTH_TOKEN (an EAS
    // secret). Both, not just the org: with the plugin in and no token,
    // its upload step fails the build — e.g. a preview build, when only
    // production has the secret. Without them it is left out.
    // The runtime SDK still reports when EXPO_PUBLIC_SENTRY_DSN is set.
    ...(process.env.SENTRY_ORG && process.env.SENTRY_AUTH_TOKEN
      ? [
          [
            "@sentry/react-native/expo",
            {
              organization: process.env.SENTRY_ORG,
              project: process.env.SENTRY_PROJECT_MOBILE ?? "maw3ed-mobile",
            },
          ] as [string, Record<string, string>],
        ]
      : []),
  ],

  experiments: { typedRoutes: true },

  /**
   * Readable at runtime through expo-constants. Public by definition —
   * it is compiled into the binary — so it holds the API's address and
   * the environment's name, and never a key, a secret or a token.
   */
  extra: {
    appEnv: APP_ENV,
    apiUrl: apiUrl(APP_ENV),
    // The EAS project (expo.dev/@amrwar/maw3ed). Not a secret: it is in
    // every build. EAS_PROJECT_ID overrides it, for a fork.
    ...(process.env.EAS_PROJECT_ID || EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID || EAS_PROJECT_ID } } : {}),
  },
});
