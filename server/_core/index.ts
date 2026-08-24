import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import * as db from "../db";
import { runMigrations } from "../migrate";
import { isProductionRuntime } from "./runtime-env";
import { registerPaymentRoutes } from "./payment-callback";
import { registerSecureDownloadRoute } from "./secure-download";
import { startCron } from "./cron";

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SEO: 检测搜索引擎爬虫 User-Agent
 */
function isSearchBot(userAgent: string): boolean {
  const botPatterns = [
    'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider',
    'yandexbot', 'sogou', 'facebookexternalhit', 'twitterbot',
    'linkedinbot', 'whatsapp', 'telegrambot', 'applebot',
  ];
  const ua = userAgent.toLowerCase();
  return botPatterns.some(bot => ua.includes(bot));
}

/**
 * SEO: 为策略详情页生成带有动态 meta 标签的 HTML
 * 当搜索引擎爬虫访问 /strategy/:id 时，返回包含策略信息的完整 HTML
 */
async function generateStrategyMetaHtml(strategyId: number, indexHtml: string): Promise<string | null> {
  try {
    const strategy = await db.getStrategyById(strategyId);
    if (!strategy) return null;

    const title = `${strategy.title} - EAXAU`;
    const description = strategy.description
      ? strategy.description.substring(0, 160)
      : `${strategy.title} - ${strategy.platform}平台EA策略，总收益率${strategy.totalReturn}%，胜率${strategy.winRate}%。EAXAU 精选策略展示。`;
    const url = `https://www.eaxau.com/strategy/${strategyId}`;
    const pairs = strategy.pairs || '';

    // 替换 <title> 标签
    let html = indexHtml.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escapeHtml(title)}</title>`
    );

    // 替换 description meta
    html = html.replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${escapeHtml(description)}" />`
    );

    // 在 </head> 前插入动态 meta 标签
    const dynamicMeta = `
    <!-- SEO: Dynamic meta for strategy ${strategyId} -->
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="article" />
    ${strategy.coverImage ? `<meta property="og:image" content="${escapeHtml(strategy.coverImage)}" />` : ''}
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${strategy.coverImage ? `<meta name="twitter:image" content="${escapeHtml(strategy.coverImage)}" />` : ''}
    <link rel="canonical" href="${url}" />
    <meta name="keywords" content="${escapeHtml(strategy.title)},${escapeHtml(strategy.platform)},${escapeHtml(pairs)},EA策略,量化交易,EAXAU,Source Desk" />
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": strategy.title,
      "description": description,
      "url": url,
      ...(strategy.coverImage ? { "image": strategy.coverImage } : {}),
      "brand": { "@type": "Brand", "name": "EAXAU" },
      "offers": {
        "@type": "Offer",
        "price": strategy.isFree ? "0" : (strategy.price || "0"),
        "priceCurrency": "CNY",
        "availability": "https://schema.org/InStock"
      }
    })}</script>
    `;

    html = html.replace('</head>', `${dynamicMeta}\n</head>`);

    return html;
  } catch (error) {
    console.error(`[SEO] Error generating meta for strategy ${strategyId}:`, error);
    return null;
  }
}

/**
 * SEO: 为首页生成带有策略列表结构化数据的 HTML
 */
async function generateHomeMetaHtml(indexHtml: string): Promise<string> {
  try {
    const strategies = await db.getStrategies({ limit: 20, offset: 0 });
    if (!strategies || strategies.length === 0) return indexHtml;

    const itemList = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "EAXAU 精选EA策略",
      "description": "EAXAU 精选MT4/MT5 EA策略展示",
      "numberOfItems": strategies.length,
      "itemListElement": strategies.map((s: any, i: number) => ({
        "@type": "ListItem",
        "position": i + 1,
        "url": `https://www.eaxau.com/strategy/${s.id}`,
        "name": s.title,
      })),
    };

    return indexHtml.replace(
      '</head>',
      `<script type="application/ld+json">${JSON.stringify(itemList)}</script>\n</head>`
    );
  } catch (error) {
    console.error('[SEO] Error generating home meta:', error);
    return indexHtml;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function collectRequiredWebAssets(indexHtml: string): string[] {
  const assets = new Set<string>();
  const attrRegex = /\s(?:src|href)=["']([^"']+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = attrRegex.exec(indexHtml)) !== null) {
    const value = match[1];
    if (value.startsWith('/_expo/static/js/') || value.startsWith('/_expo/static/css/')) {
      assets.add(value);
    }
  }

  return Array.from(assets);
}

function validateWebBuild(webBuildPath: string, indexPath: string, indexHtml: string): void {
  const requiredAssets = collectRequiredWebAssets(indexHtml);

  if (requiredAssets.length === 0) {
    throw new Error('[static] index.html does not reference any required Expo JS/CSS assets');
  }

  const missingAssets = requiredAssets.filter((asset) => {
    const assetPath = path.join(webBuildPath, asset.replace(/^\//, ''));
    return !fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile();
  });

  if (missingAssets.length > 0) {
    throw new Error(`[static] web-build is incomplete. Missing asset(s): ${missingAssets.join(', ')}`);
  }

  const jsAssets = requiredAssets.filter((asset) => asset.endsWith('.js'));
  const cssAssets = requiredAssets.filter((asset) => asset.endsWith('.css'));

  if (jsAssets.length === 0 || cssAssets.length === 0) {
    throw new Error(`[static] web-build is incomplete. Found ${jsAssets.length} JS asset(s) and ${cssAssets.length} CSS asset(s)`);
  }

  for (const asset of jsAssets) {
    const assetPath = path.join(webBuildPath, asset.replace(/^\//, ''));
    const firstBytes = fs.readFileSync(assetPath, 'utf8').slice(0, 80).trimStart();
    if (firstBytes.startsWith('<!DOCTYPE') || firstBytes.startsWith('<html')) {
      throw new Error(`[static] JavaScript asset resolved to HTML: ${asset}`);
    }
  }

  console.log(`[static] verified ${requiredAssets.length} required web asset(s) from ${path.relative(process.cwd(), indexPath)}`);
}

function isStaticAssetRequest(reqPath: string): boolean {
  return (
    reqPath.startsWith('/_expo/') ||
    reqPath.startsWith('/assets/') ||
    reqPath.startsWith('/ea-covers/') ||
    reqPath.startsWith('/ea-covers-v2/') ||
    reqPath.startsWith('/strategy-art/') ||
    reqPath.startsWith('/charts/') ||
    reqPath === '/favicon.ico' ||
    reqPath === '/metadata.json' ||
    /\.[a-zA-Z0-9]{2,8}$/.test(reqPath)
  );
}

async function startServer() {
  // 自动执行数据库迁移（安全的，可重复执行）
  console.log("[startup] Running database migrations...");
  await runMigrations();
  console.log("[startup] Migrations complete, starting server...");
  startCron();

  const app = express();
  const server = createServer(app);

  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    "https://eaxau.com",
    "https://www.eaxau.com",
    ...configuredOrigins,
    ...(!isProductionRuntime()
      ? ["http://localhost:8081", "http://localhost:3000"]
      : []),
  ]);

  // Credentialed CORS 只对明确的站点开放，不再反射任意 Origin。
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Admin-Token",
    );
    res.header("X-Content-Type-Options", "nosniff");
    res.header("Referrer-Policy", "strict-origin-when-cross-origin");
    res.header("X-Frame-Options", "SAMEORIGIN");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(!origin || allowedOrigins.has(origin) ? 204 : 403);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ limit: "2mb", extended: true }));

  registerOAuthRoutes(app);
  registerPaymentRoutes(app);
  registerSecureDownloadRoute(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // SEO: 生成 sitemap.xml
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const strategies = await db.getStrategies({ limit: 100, offset: 0 });
      const now = new Date().toISOString().split('T')[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.eaxau.com/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

      if (strategies && strategies.length > 0) {
        for (const s of strategies) {
          const lastmod = s.updatedAt
            ? new Date(s.updatedAt).toISOString().split('T')[0]
            : now;
          xml += `
  <url>
    <loc>https://www.eaxau.com/strategy/${s.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
        }
      }

      xml += '\n</urlset>';

      res.header('Content-Type', 'application/xml');
      res.header('Cache-Control', 'public, max-age=3600'); // 缓存1小时
      res.send(xml);
    } catch (error) {
      console.error('[SEO] Error generating sitemap:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // SEO: robots.txt
  app.get("/robots.txt", (_req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /oauth/

Sitemap: https://www.eaxau.com/sitemap.xml
`);
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // 静态文件服务 - 为Web应用提供静态文件
  const webBuildPath = path.resolve(process.cwd(), 'web-build');
  console.log(`[static] serving files from ${webBuildPath}`);
  
  // 检查web-build目录是否存在
  const indexPath = path.join(webBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    console.log(`[static] web-build directory exists`);
    const optimizedCoversPath = path.join(webBuildPath, 'ea-covers-v2');
    if (fs.existsSync(optimizedCoversPath)) {
      app.use('/ea-covers-v2', express.static(optimizedCoversPath, {
        maxAge: '1y',
        immutable: true,
      }));
    }
    app.use(express.static(webBuildPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (filePath.includes(`${path.sep}_expo${path.sep}static${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.includes(`${path.sep}strategy-art${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        }
      },
    }));

    // 读取并缓存 index.html
    let cachedIndexHtml = '';
    try {
      cachedIndexHtml = fs.readFileSync(indexPath, 'utf-8');
      validateWebBuild(webBuildPath, indexPath, cachedIndexHtml);
    } catch (err) {
      console.error('[static] Failed to validate web-build:', err);
      if (isProductionRuntime()) {
        throw err;
      }
    }
    
    // SPA路由支持 - 所有非API请求返回index.html
    // 对搜索引擎爬虫返回带有动态 meta 标签的 HTML
    app.get('*', async (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }

      if (isStaticAssetRequest(req.path)) {
        return res.status(404).type('text/plain').send('Static asset not found');
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const userAgent = req.headers['user-agent'] || '';
      const isCrawler = isSearchBot(userAgent);

      // 如果是搜索引擎爬虫，注入动态 SEO meta 标签
      if (isCrawler && cachedIndexHtml) {
        try {
          // 策略详情页: /strategy/:id
          const strategyMatch = req.path.match(/^\/strategy\/(\d+)/);
          if (strategyMatch) {
            const strategyId = parseInt(strategyMatch[1]);
            const html = await generateStrategyMetaHtml(strategyId, cachedIndexHtml);
            if (html) {
              res.header('Content-Type', 'text/html');
              return res.send(html);
            }
          }

          // 首页
          if (req.path === '/' || req.path === '') {
            const html = await generateHomeMetaHtml(cachedIndexHtml);
            res.header('Content-Type', 'text/html');
            return res.send(html);
          }
        } catch (error) {
          console.error('[SEO] Error in crawler middleware:', error);
          // 出错时回退到普通 index.html
        }
      }

      // 普通用户或爬虫回退：返回原始 index.html
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`[static] error serving index.html:`, err);
          next(err);
        }
      });
    });
  } else {
    console.warn(`[static] web-build directory not found at ${webBuildPath}`);
    if (isProductionRuntime()) {
      throw new Error('[static] web-build/index.html not found. Run pnpm build:web before deployment.');
    }
  }

  const port = parseInt(process.env.PORT || "3000");
  
  server.listen(port, () => {
    console.log(`✓ [api] server listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error("[startup] Fatal startup error:", error);
  process.exitCode = 1;
});
