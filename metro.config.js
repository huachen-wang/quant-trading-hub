const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);
const isCiOrProdBuild = process.env.CI === "true" || process.env.NODE_ENV === "production";

// === 性能 P0 改造 ===

// 1. 生产构建丢掉 console.log/info/debug，保留 console.warn/error
config.transformer.minifierConfig = {
  ...(config.transformer.minifierConfig ?? {}),
  compress: {
    ...(config.transformer.minifierConfig?.compress ?? {}),
    drop_console: ["log", "info", "debug"],
    pure_funcs: ["console.log", "console.debug", "console.info"],
    unused: true,
    passes: 2,
  },
  mangle: { safari10: true },
  format: { comments: false },
};

// 2. 防止 server 代码泄漏到 web bundle
const SERVER_ONLY_PACKAGES = new Set([
  "mysql2",
  "mysql2/promise",
  "pg",
  "postgres",
  "better-sqlite3",
  "drizzle-orm/mysql2",
  "drizzle-orm/node-postgres",
  "drizzle-orm/postgres-js",
  "drizzle-orm/better-sqlite3",
  "bcrypt",
  "bcryptjs",
  "nodemailer",
  "resend",
]);

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, moduleName, platform) => {
  // 仅在 web 平台拦截
  if (platform === "web") {
    if (SERVER_ONLY_PACKAGES.has(moduleName)) {
      // 替换为空 stub，避免大型驱动进 bundle
      return {
        type: "sourceFile",
        filePath: path.resolve(__dirname, "shims/empty-module.js"),
      };
    }
  }
  return (upstreamResolveRequest ?? ctx.resolveRequest)(ctx, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: !isCiOrProdBuild,
});
