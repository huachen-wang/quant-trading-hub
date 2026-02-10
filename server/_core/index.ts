import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Diagnostic endpoint to check database connection
  app.get("/api/db-diag", async (req, res) => {
    if (req.headers["x-admin-token"] !== "admin123") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const dbUrl = process.env.DATABASE_URL || "NOT SET";
      // Mask password in URL
      const maskedUrl = dbUrl.replace(/:[^:@]+@/, ":***@");
      const mysql2 = await import("mysql2/promise");
      const conn = await mysql2.default.createConnection(dbUrl);
      const [tables] = await conn.query("SHOW TABLES");
      const tableNames = (tables as any[]).map((r: any) => Object.values(r)[0]);
      const [dbResult] = await conn.query("SELECT DATABASE() as db");
      await conn.end();
      res.json({
        ok: true,
        database: (dbResult as any[])[0]?.db,
        maskedUrl: maskedUrl.substring(0, 80),
        tables: tableNames,
        nodeEnv: process.env.NODE_ENV,
      });
    } catch (e: any) {
      res.json({ ok: false, error: e.message });
    }
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
  if (fs.existsSync(webBuildPath)) {
    console.log(`[static] web-build directory exists`);
    app.use(express.static(webBuildPath));
    
    // SPA路由支持 - 所有非API请求返回index.html
    app.get('*', (req, res, next) => {
      if (!req.path.startsWith('/api')) {
        const indexPath = path.join(webBuildPath, 'index.html');
        console.log(`[static] serving ${indexPath} for ${req.path}`);
        res.sendFile(indexPath, (err) => {
          if (err) {
            console.error(`[static] error serving index.html:`, err);
            next(err);
          }
        });
      } else {
        next();
      }
    });
  } else {
    console.warn(`[static] web-build directory not found at ${webBuildPath}`);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
