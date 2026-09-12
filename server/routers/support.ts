/**
 * 站内咨询的 tRPC 端点。
 *
 * 公开端点（访客可调）：send / thread / entry
 * 管理端点（adminProcedure，沿用现有 JWT 管理员鉴权）：list / thread / reply / setStatus / drain
 *
 * 这里只做入参校验、身份取值和错误码映射；业务规则全在 `server/support/service.ts`。
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { adminProcedure } from "./_admin";
import { requestIp } from "../_core/admin-security-throttle";
import {
  SupportError,
  fetchVisitorThread,
  getAdminThread,
  listAdminConversations,
  replyAsOperator,
  resolveQq,
  sendCustomerMessage,
  setConversationStatus,
} from "../support/service";
import { processDueSupportNotifications, resolveTelegramConfig } from "../support/notify";
import { buildQqLine } from "../../lib/support-faq";
import {
  SUPPORT_AUTO_DISCLOSURE,
  SUPPORT_MESSAGE_MAX_LENGTH,
} from "../../shared/support/contracts";

function toTrpcError(error: unknown): never {
  if (error instanceof SupportError) {
    throw new TRPCError({ code: error.code, message: error.message });
  }
  throw error;
}

const visitorTokenSchema = z.string().min(16).max(200);
const strategyIdSchema = z.number().int().positive().nullable().optional();

export const supportRouter = router({
  /**
   * 咨询面板要展示的静态信息：机器人身份声明 + QQ 入口。
   * 纯读、不写库、不建会话——打开弹窗不产生任何线索。
   */
  entry: publicProcedure.query(async () => {
    const qq = await resolveQq();
    return {
      autoDisclosure: SUPPORT_AUTO_DISCLOSURE.zh,
      qq,
      qqLine: buildQqLine({ qq }),
      maxLength: SUPPORT_MESSAGE_MAX_LENGTH,
    };
  }),

  send: publicProcedure
    .input(
      z.object({
        visitorToken: visitorTokenSchema,
        clientMsgId: z.string().min(8).max(64),
        body: z.string().min(1).max(SUPPORT_MESSAGE_MAX_LENGTH),
        strategyId: strategyIdSchema,
        pageUrl: z.string().max(500).nullable().optional(),
        locale: z.string().max(8).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await sendCustomerMessage({
          visitorToken: input.visitorToken,
          clientMsgId: input.clientMsgId,
          body: input.body,
          strategyId: input.strategyId ?? null,
          pageUrl: input.pageUrl ?? null,
          locale: input.locale ?? "zh",
          // 管理员账号不占用访客身份；只有真实登录用户才绑定会话。
          userId: ctx.user && ctx.user.role !== "admin" ? ctx.user.id : null,
          ip: requestIp(ctx.req as any),
        });
      } catch (error) {
        toTrpcError(error);
      }
    }),

  thread: publicProcedure
    .input(
      z.object({
        visitorToken: visitorTokenSchema,
        strategyId: strategyIdSchema,
        afterId: z.number().int().min(0).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        return await fetchVisitorThread({
          visitorToken: input.visitorToken,
          strategyId: input.strategyId ?? null,
          afterId: input.afterId ?? 0,
          userId: ctx.user && ctx.user.role !== "admin" ? ctx.user.id : null,
        });
      } catch (error) {
        toTrpcError(error);
      }
    }),
});

export const supportAdminRouter = router({
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(["open", "answered", "closed", "all"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return await listAdminConversations(input);
      } catch (error) {
        toTrpcError(error);
      }
    }),

  thread: adminProcedure
    .input(z.object({ publicNo: z.string().min(3).max(32) }))
    .query(async ({ input }) => {
      try {
        return await getAdminThread({ publicNo: input.publicNo });
      } catch (error) {
        toTrpcError(error);
      }
    }),

  reply: adminProcedure
    .input(
      z.object({
        publicNo: z.string().min(3).max(32),
        body: z.string().min(1).max(SUPPORT_MESSAGE_MAX_LENGTH),
        clientMsgId: z.string().min(8).max(64).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        return await replyAsOperator({
          publicNo: input.publicNo,
          body: input.body,
          clientMsgId: input.clientMsgId ?? null,
          operatorId: ctx.user.id,
        });
      } catch (error) {
        toTrpcError(error);
      }
    }),

  setStatus: adminProcedure
    .input(
      z.object({
        publicNo: z.string().min(3).max(32),
        status: z.enum(["open", "answered", "closed"]),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await setConversationStatus(input);
      } catch (error) {
        toTrpcError(error);
      }
    }),

  /** 后台手动催一次外发箱，并回显当前提醒开关状态（live / dry_run）。 */
  drain: adminProcedure.mutation(async () => {
    const config = resolveTelegramConfig();
    const result = await processDueSupportNotifications();
    return { ...result, configured: config.mode === "live" };
  }),

  notifyStatus: adminProcedure.query(() => {
    const config = resolveTelegramConfig();
    return {
      mode: config.mode,
      hasToken: Boolean(config.botToken),
      hasChatId: Boolean(config.chatId),
    };
  }),
});
