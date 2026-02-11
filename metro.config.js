const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const isCiOrProdBuild = process.env.CI === "true" || process.env.NODE_ENV === "production";

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Writing CSS into node_modules cache can fail in CI image builds.
  // Keep it for local dev only; disable in CI/production builds.
  forceWriteFileSystem: !isCiOrProdBuild,
});
