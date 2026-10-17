import type { User } from "../../drizzle/schema";

/**
 * 返回给浏览器的用户对象只能经过这里（2026-10-18 安全修复）。
 *
 * 原来 tRPC 的 auth.me 直接返回 ctx.user、验证码登录成功直接返回整行用户记录，
 * 密码哈希（passwordHash）就这样到了前端。这里用**白名单**挑字段：
 * 以后 users 表加了新列（令牌、风控标记……），不在名单里就出不去。
 */
export const USER_RESPONSE_FIELDS = [
  "id",
  "openId",
  "name",
  "email",
  "avatar",
  "bio",
  "loginMethod",
  "role",
  "phone",
  "phoneVerified",
  "createdAt",
  "updatedAt",
  "lastSignedIn",
] as const satisfies ReadonlyArray<keyof User>;

export type UserResponseField = (typeof USER_RESPONSE_FIELDS)[number];
export type UserResponse = Partial<Pick<User, UserResponseField>>;

export function toUserResponse(user: Partial<User> | Record<string, unknown> | null | undefined): UserResponse | null {
  if (!user) return null;
  const source = user as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const field of USER_RESPONSE_FIELDS) {
    if (field in source) safe[field] = source[field];
  }
  return safe as UserResponse;
}
