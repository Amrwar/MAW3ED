// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

/**
 * Expo's recommended rules — React, hooks and React Native, tuned for
 * this toolchain — and nothing added on top yet. Generated and build
 * output is ignored.
 */
module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "android/*", "ios/*", "node_modules/*"],
  },
]);
