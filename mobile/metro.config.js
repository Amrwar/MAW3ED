// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

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
 * getDefaultConfig returns Expo's config, which lists font extensions
 * among assetExts. Exported unmodified — this file exists so the
 * defaults are actually applied, not to change them.
 */
module.exports = getDefaultConfig(__dirname);
