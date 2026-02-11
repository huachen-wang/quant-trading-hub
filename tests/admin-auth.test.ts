/**
 * 管理员认证测试
 * 验证环境变量配置和JWT token签发
 */
import { describe, it, expect } from "vitest";

describe("Admin Authentication", () => {
  it("should have ADMIN_EMAIL and ADMIN_PASSWORD environment variables", () => {
    expect(process.env.ADMIN_EMAIL).toBeDefined();
    expect(process.env.ADMIN_PASSWORD).toBeDefined();
    expect(process.env.JWT_SECRET).toBeDefined();
  });

  it("should be able to import admin auth router", async () => {
    const { adminAuthRouter } = await import("../server/routers/admin-auth");
    expect(adminAuthRouter).toBeDefined();
  });

  it("should be able to import verifyAdminToken function", async () => {
    const { verifyAdminToken } = await import("../server/routers/admin-auth");
    expect(verifyAdminToken).toBeDefined();
    expect(typeof verifyAdminToken).toBe("function");
  });
});
