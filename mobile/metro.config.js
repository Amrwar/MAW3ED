// Learn more https://docs.expo.dev/guides/customizing-metro
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

/**
 * Metro, with Expo's defaults.
 *
 * The project had no metro.config.js, which works until something
 * imports an asset the bare defaults do not know about. Adding icons
 * was that something: `@expo/vector-icons` imports a .ttf per icon set,
 * and the bundler stopped at
 *
 *   Unable to resolve ./vendor/.../Fonts/Foundation.ttf
 *
 * leaving a blank screen with the failure only in the Metro log.
 *
 * getSentryExpoConfig is Expo's getDefaultConfig (which lists font
 * extensions among assetExts) plus Sentry's serializer, which stamps a
 * debug id into each bundle so uploaded source maps match crash reports.
 * Nothing else is changed.
 */
module.exports = getSentryExpoConfig(__dirname);
