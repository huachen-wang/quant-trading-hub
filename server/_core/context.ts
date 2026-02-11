import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifyAdminToken } from "../routers/admin-auth";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@eaxau.com";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. 先检查X-Admin-Token header（JWT token认证）
  const adminToken = opts.req.headers["x-admin-token"] as string | undefined;
  if (adminToken) {
    const payload = await verifyAdminToken(adminToken);
    if (payload && payload.role === "admin") {
      // 创建一个虚拟admin用户对象，满足adminProcedure的检查
      user = {
        id: 0,
        openId: "admin-jwt",
        name: "管理员",
        email: payload.email,
        passwordHash: null,
        avatar: null,
        bio: null,
        loginMethod: "jwt",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };
      return { req: opts.req, res: opts.res, user };
    }
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
