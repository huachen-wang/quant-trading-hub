import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";

/**
 * 后台接口：已登录但不是管理员 → 403 FORBIDDEN（2026-10-17；原来抛普通 Error，变成 500）。
 * 未登录仍由 protectedProcedure 返回 401。
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Unauthorized: Admin access required" });
  }
  return next();
});
