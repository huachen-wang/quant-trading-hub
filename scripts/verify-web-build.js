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

function verifyBootstrapReadiness(bootstrapScript) {
  const boot = { hidden: false };
  const root = {
    textContent: "",
    querySelector: () => null,
  };
  let onReady;
  let onMutation;

  class MockMutationObserver {
    constructor(callback) {
      onMutation = callback;
    }

    observe() {}
    disconnect() {}
  }

  const windowMock = {
    addEventListener() {},
    MutationObserver: MockMutationObserver,
    sessionStorage: {
      getItem: () => null,
      setItem() {},
      removeItem() {},
    },
    setTimeout() {},
  };
  const documentMock = {
    addEventListener(eventName, callback) {
      if (eventName === "DOMContentLoaded") onReady = callback;
    },
    getElementById(id) {
      if (id === "eaxau-boot") return boot;
      if (id === "root") return root;
      return null;
    },
    querySelector: () => null,
  };

  new Function(
    "window",
    "document",
    "URL",
    "MutationObserver",
    bootstrapScript,
  )(
    windowMock,
    documentMock,
    URL,
    MockMutationObserver,
  );
  onReady?.();

  if (boot.hidden) {
    throw new Error("EAXAU loading bootstrap hides on an empty app container");
  }

  root.textContent = "EAXAU";
  onMutation?.();
  if (!boot.hidden) {
    throw new Error("EAXAU loading bootstrap stays visible after app content mounts");
  }
}

function main() {
  if (!fs.existsSync(indexPath)) {
    throw new Error("web-build/index.html was not generated");
  }

  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const requiredAssets = collectRequiredAssets(indexHtml);

  if (!indexHtml.includes('data-eaxau-bootstrap="v1"')) {
    throw new Error("web-build/index.html is missing the EAXAU loading bootstrap");
  }
  if (!indexHtml.includes('id="eaxau-boot"')) {
    throw new Error("web-build/index.html is missing the EAXAU loading element");
  }

  const bootstrapScript = indexHtml.match(
    /<script[^>]*data-eaxau-bootstrap="v1"[^>]*>([\s\S]*?)<\/script>/,
  )?.[1];
  if (!bootstrapScript) {
    throw new Error("web-build/index.html is missing the EAXAU recovery script");
  }
  new Function(bootstrapScript);
  if (!bootstrapScript.includes("rootHasVisibleContent")) {
    throw new Error("EAXAU loading bootstrap is missing its content-ready check");
  }
  if (!bootstrapScript.includes("subtree: true")) {
    throw new Error("EAXAU loading bootstrap is not observing nested app content");
  }
  verifyBootstrapReadiness(bootstrapScript);

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
