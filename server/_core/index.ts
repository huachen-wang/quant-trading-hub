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
import { assertFundingCustodyProviderReady } from "./payments/funding-custody-provider";
import { isAdminTotpConfigured } from "./admin-totp";
import { safeJsonLd } from "./seo-json";
import { buildContentSecurityPolicy } from "./http-security";
import { legacyRouteRedirect } from "./legacy-route-redirect";
import { seoPublishedList, seoStrategyById } from "./seo-catalog";
import {
  renderHomeHtml,
  renderNotFoundHtml,
  renderStrategyHtml,
  renderUnavailableHtml,
  type ListLookup,
  type StrategyLookup,
} from "./seo-render";

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SEO 查询三态，全部走 ./seo-catalog 的专用只读适配器：
 * - 没有真实数据库连接 / 查询失败 → unavailable（503），绝不退回 db.ts 的 mock 兜底；
 * - 真实缺失或 status 不是 published → missing（404）；
 * - published → ok（200）。
 */
async function lookupStrategy(strategyId: number): Promise<StrategyLookup> {
  return seoStrategyById(strategyId);
}

async function lookupHomeList(): Promise<ListLookup> {
  return seoPublishedList(24);
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
  // BVNK/Cobo 适配器在实际凭据、Webhook 和幂等对账完成前 fail closed。
  // 当前 MANUAL 只记录外部企业钱包/托管商的操作，服务器不签名转币。
  assertFundingCustodyProviderReady();
  // 未配置 TOTP 时只禁用企业代收；若已配置则启动时立即校验强度与 Base32 格式。
  isAdminTotpConfigured();
  // 自动执行数据库迁移（安全的，可重复执行）
  console.log("[startup] Running database migrations...");
  const migrationsClean = await runMigrations();
  if (migrationsClean) {
    console.log("[startup] Migrations complete, starting server...");
  } else {
    // 非生产环境下迁移失败不阻断启动（既有行为），但日志不能谎称跑完了：
    // 「服务在跑」和「表都建好了」是两件事，上面已经打过具体错误。
    console.warn(
      "[startup] Migrations FAILED (non-production continues anyway) — 部分表可能不存在，" +
        "相关接口会报错。请看上面的 [migrate] 错误。",
    );
  }
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
    res.header(
      "Content-Security-Policy",
      buildContentSecurityPolicy(isProductionRuntime()),
    );

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

  // 兼容曾经暴露给用户的 Expo 内部路由组 URL，避免进入 SPA 后显示 Unmatched Route。
  app.use(legacyRouteRedirect);

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
      /* index:false —— 根路径交给下面的 SPA/SEO 处理器渲染首页正文；
         静态中间件如果先把 index.html 直接吐出来，首页就永远拿不到 canonical/h1/商品清单。 */
      index: false,
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

      /* 初始 HTML 对所有 User-Agent 一致：普通访客和搜索引擎拿到同一份正文，
         不做 UA 分支，也不因此改变购买、下载或交互权限（React/Expo 应用照常挂载）。 */
      if (cachedIndexHtml) {
        try {
          /* /strategy 命名空间整体归这里管：只有「单段、纯正整数、无前导 0」才是可能存在的商品；
             /strategy/abc、/strategy/-1、/strategy/30/extra 这类地址永远不会有商品，
             直接真 404，不去查库、也不落到 SPA 壳返回 200。 */
          if (req.path === '/strategy' || req.path === '/strategy/' || req.path.startsWith('/strategy/')) {
            const strategyMatch = req.path.match(/^\/strategy\/(0|[1-9]\d{0,9})\/?$/);
            if (!strategyMatch) {
              res.header('Content-Type', 'text/html; charset=utf-8');
              return res.status(404).send(renderNotFoundHtml(cachedIndexHtml, req.path));
            }
            const strategyId = Number.parseInt(strategyMatch[1], 10);
            const lookup = await lookupStrategy(strategyId);
            res.header('Content-Type', 'text/html; charset=utf-8');
            if (lookup.kind === 'ok') {
              return res.status(200).send(renderStrategyHtml(cachedIndexHtml, lookup.strategy));
            }
            if (lookup.kind === 'missing') {
              /* 真的不存在就真 404，不用 200 的 SPA 壳冒充。 */
              return res.status(404).send(renderNotFoundHtml(cachedIndexHtml, req.path));
            }
            /* 数据源故障 = 503 + Retry-After，明确区别于「已下架」。 */
            res.setHeader('Retry-After', '120');
            return res.status(503).send(renderUnavailableHtml(cachedIndexHtml));
          }

          if (req.path === '/' || req.path === '') {
            const lookup = await lookupHomeList();
            res.header('Content-Type', 'text/html; charset=utf-8');
            if (lookup.kind === 'unavailable') {
              /* 真实商品库读不到就给 503，不返回 200 空清单——200 会让搜索引擎
                 把「这个站没有商品」当成当前事实收走。 */
              res.setHeader('Retry-After', '120');
              return res.status(503).send(renderUnavailableHtml(cachedIndexHtml));
            }
            return res.status(200).send(renderHomeHtml(cachedIndexHtml, lookup));
          }
        } catch (error) {
          console.error('[SEO] Error rendering initial HTML:', error);
          // 渲染本身出错时回退到原始 index.html，交互不受影响
        }
      }

      // 其余前端路由：返回原始 index.html，由应用接管
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
