const fs = require("fs");
const path = require("path");

const webBuildDir = path.resolve(process.cwd(), "web-build");
const indexPath = path.join(webBuildDir, "index.html");

function collectRequiredAssets(indexHtml) {
  const assets = new Set();
  const attrRegex = /\s(?:src|href)=["']([^"']+)["']/g;
  let match;

  while ((match = attrRegex.exec(indexHtml)) !== null) {
    const value = match[1];
    if (value.startsWith("/_expo/static/js/") || value.startsWith("/_expo/static/css/")) {
      assets.add(value);
    }
  }

  return Array.from(assets);
}

function verifyAsset(assetPath) {
  const diskPath = path.join(webBuildDir, assetPath.replace(/^\//, ""));
  if (!fs.existsSync(diskPath)) {
    throw new Error(`Missing required web asset: ${assetPath}`);
  }

  const stat = fs.statSync(diskPath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`Invalid empty web asset: ${assetPath}`);
  }

  if (assetPath.endsWith(".js")) {
    const firstBytes = fs.readFileSync(diskPath, "utf8").slice(0, 80).trimStart();
    if (firstBytes.startsWith("<!DOCTYPE") || firstBytes.startsWith("<html")) {
      throw new Error(`JavaScript asset resolved to HTML: ${assetPath}`);
    }
  }
}

function main() {
  if (!fs.existsSync(indexPath)) {
    throw new Error("web-build/index.html was not generated");
  }

  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const requiredAssets = collectRequiredAssets(indexHtml);

  if (requiredAssets.length === 0) {
    throw new Error("web-build/index.html does not reference any Expo JS/CSS assets");
  }

  requiredAssets.forEach(verifyAsset);

  const jsCount = requiredAssets.filter((asset) => asset.endsWith(".js")).length;
  const cssCount = requiredAssets.filter((asset) => asset.endsWith(".css")).length;

  if (jsCount === 0 || cssCount === 0) {
    throw new Error(`Expected at least one JS and one CSS asset, found ${jsCount} JS and ${cssCount} CSS`);
  }

  console.log(`[verify-web-build] OK: ${requiredAssets.length} required asset(s), ${jsCount} JS, ${cssCount} CSS`);
}

main();
