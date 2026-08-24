/**
 * Simple Cron — 简单的定时任务调度器
 *
 * 不引入 node-cron 等外部依赖，用 setInterval 实现最基础的定时调度。
 * 适合当前阶段（任务量小、单实例部署）。
 *
 * 当前任务：
 *   - 每 5 分钟把 status='pending' 且 expiresAt < now 的订单标记为 expired
 *   - 每 1 分钟把到期资管会话切换为 EXIT_REQUESTED 并禁止新执行
 *   - 每 6 小时清理过期验证码
 *
 * 未来如果需要更复杂调度（cron 表达式、分布式 lock 等），可以换 node-cron 或 BullMQ。
 */

import { expireDueManagedSessions, expireStaleOrders } from "../db";
import { cleanupExpiredCodes } from "./verification";

let started = false;
let intervals: ReturnType<typeof setInterval>[] = [];

/**
 * 启动 cron 调度
 * 应该在服务器启动后（migrate 完成后）调用一次
 */
export function startCron() {
  if (started) {
    console.warn("[cron] already started, skip");
    return;
  }
  started = true;

  console.log("[cron] starting scheduled tasks...");

  // 任务 1：每 5 分钟检查过期订单
  const orderExpireInterval = setInterval(async () => {
    try {
      const count = await expireStaleOrders();
      if (count > 0) {
        console.log(`[cron] expired ${count} stale orders`);
      }
    } catch (e) {
      console.error("[cron] order expire failed:", e);
    }
  }, 5 * 60 * 1000);
  intervals.push(orderExpireInterval);

  // 任务 2：每分钟关闭已到期资管会话的新执行权。
  // 这里只改内部状态为 EXIT_REQUESTED，不直接平仓或转币。
  const managedSessionExpireInterval = setInterval(async () => {
    try {
      const count = await expireDueManagedSessions();
      if (count > 0) {
        console.log(`[cron] requested exit for ${count} expired managed session(s)`);
      }
    } catch (e) {
      console.error("[cron] managed session expiry failed:", e);
    }
  }, 60 * 1000);
  intervals.push(managedSessionExpireInterval);

  // 任务 3：每 6 小时清理过期验证码
  const codeCleanupInterval = setInterval(async () => {
    try {
      const count = await cleanupExpiredCodes();
      if (count > 0) {
        console.log(`[cron] cleaned ${count} expired verification codes`);
      }
    } catch (e) {
      console.error("[cron] code cleanup failed:", e);
    }
  }, 6 * 60 * 60 * 1000);
  intervals.push(codeCleanupInterval);

  // 启动后立即执行一次（不等 5 分钟）
  setTimeout(async () => {
    try {
      const count = await expireStaleOrders();
      if (count > 0) {
        console.log(`[cron] startup: expired ${count} stale orders`);
      }
    } catch (e) {
      console.error("[cron] startup task failed:", e);
    }
  }, 30 * 1000); // 启动 30 秒后

  console.log("[cron] ✓ scheduled tasks started");
}

/**
 * 停止 cron 调度（用于测试或优雅关闭）
 */
export function stopCron() {
  intervals.forEach((i) => clearInterval(i));
  intervals = [];
  started = false;
  console.log("[cron] stopped");
}
