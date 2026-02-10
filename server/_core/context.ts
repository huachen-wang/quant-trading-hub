import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

// Admin密码 - 与前端login.tsx中的密码一致
const ADMIN_PASSWORD = "admin123";
const ADMIN_EMAIL = "admin@eaxau.com";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. 先检查X-Admin-Token header（独立admin认证，不依赖OAuth）
  const adminToken = opts.req.headers["x-admin-token"] as string | undefined;
  if (adminToken === ADMIN_PASSWORD) {
    // 创建一个虚拟admin用户对象，满足adminProcedure的检查
    user = {
      id: 0,
      openId: "admin-local",
      name: "管理员",
      email: ADMIN_EMAIL,
      avatar: null,
      bio: null,
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    return { req: opts.req, res: opts.res, user };
  }

  // 2. 否则尝试OAuth session认证
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
