const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8081;
const webBuildDir = path.join(__dirname, 'web-build');
const legacyDistDir = path.join(__dirname, 'dist');
const staticDir = fs.existsSync(path.join(webBuildDir, 'index.html')) ? webBuildDir : legacyDistDir;
const indexPath = path.join(staticDir, 'index.html');

function collectRequiredAssets(indexHtml) {
  const assets = new Set();
  const attrRegex = /\s(?:src|href)=["']([^"']+)["']/g;
  let match;

  while ((match = attrRegex.exec(indexHtml)) !== null) {
    const value = match[1];
    if (value.startsWith('/_expo/static/js/') || value.startsWith('/_expo/static/css/')) {
      assets.add(value);
    }
  }

  return Array.from(assets);
}

function verifyStaticBuild() {
  if (!fs.existsSync(indexPath)) {
    throw new Error(`[static] Missing ${indexPath}. Run pnpm build:web before starting the web server.`);
  }

  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const requiredAssets = collectRequiredAssets(indexHtml);
  if (requiredAssets.length === 0) {
    throw new Error('[static] index.html does not reference any Expo JS/CSS assets.');
  }

  for (const asset of requiredAssets) {
    const assetPath = path.join(staticDir, asset.replace(/^\//, ''));
    if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
      throw new Error(`[static] Missing required asset ${asset}`);
    }
  }

  console.log(`[static] verified ${requiredAssets.length} required web asset(s)`);
}

function isAssetRequest(reqPath) {
  return (
    reqPath.startsWith('/_expo/') ||
    reqPath.startsWith('/assets/') ||
    reqPath.startsWith('/ea-covers/') ||
    reqPath.startsWith('/charts/') ||
    reqPath === '/favicon.ico' ||
    reqPath === '/metadata.json' ||
    /\.[a-zA-Z0-9]{2,8}$/.test(reqPath)
  );
}

// 静态文件目录
verifyStaticBuild();
app.use(express.static(staticDir));

// SPA路由支持 - 所有请求都返回index.html
app.get('*', (req, res) => {
  if (isAssetRequest(req.path)) {
    return res.status(404).type('text/plain').send('Static asset not found');
  }

  res.sendFile(indexPath);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server listening on http://0.0.0.0:${PORT}`);
});
