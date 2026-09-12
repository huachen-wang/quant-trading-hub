/**
 * Simple Cron — 简单的定时任务调度器
 *
 * 不引入 node-cron 等外部依赖，用 setInterval 实现最基础的定时调度。
 * 适合当前阶段（任务量小、单实例部署）。
 *
 * 当前任务：
 *   - 每 5 分钟把 status='pending' 且 expiresAt < now 的订单标记为 expired
 *   - 每 6 小时清理过期验证码
 *
 * 未来如果需要更复杂调度（cron 表达式、分布式 lock 等），可以换 node-cron 或 BullMQ。
 */

import { expireStaleOrders } from "../db";
import { processDueSupportNotifications } from "../support/notify";
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

  // 任务 2：每 6 小时清理过期验证码。
  // AI 量化联盟为正常长期委托，不存在到期自动退出任务。
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

  // 任务 3：每分钟推一次站内咨询提醒外发箱。
  // 这是「兜底」，不是唯一驱动：客户发完消息会立刻异步 drain 一次。
  // 有这一路，投递失败（Telegram 429 / 网络抖动）或进程崩在 sending 上的租约才会被重投/回收，
  // 而不是像内存重试那样一次失败就永远静默丢掉。复用既有调度器，不新起独立轮询进程。
  const supportNotifyInterval = setInterval(async () => {
    try {
      const result = await processDueSupportNotifications();
      if (result.claimed > 0) {
        console.log(
          `[cron] support notifications: mode=${result.mode} claimed=${result.claimed} sent=${result.sent} held=${result.held} retried=${result.retried} failed=${result.failed}`,
        );
      }
    } catch (e) {
      console.error("[cron] support notification drain failed:", e);
    }
  }, 60 * 1000);
  intervals.push(supportNotifyInterval);

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
