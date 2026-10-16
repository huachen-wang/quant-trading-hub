import net from "node:net";
import { requestIp } from "./admin-security-throttle";

/**
 * 登录限流用的「访客 IP」（2026-10-17 安全修复）。
 *
 * 线上链路是 访客 → Cloudflare → Railway 边缘代理 → 本进程。2026-10-17 只读核对生产库：
 * 本进程看到的 socket 对端全是 Railway 代理的内网 / CGNAT 地址（同一时间只有几个），
 * 拿它当 IP 计数，等于所有访客共用几个桶，一个人就能把大家都锁住。所以要从请求头里取。
 *
 * 取法（不信任访客自己能随便填的值）：
 * 1. 运维显式配置了 ADMIN_TRUSTED_PROXY_HOPS → 沿用原来按代理层数从右往左取的规则；
 * 2. 否则看 X-Forwarded-For 最右边一项（由基础设施追加，访客只能往左边塞值）：
 *    - 它在 Cloudflare 的公开网段里 → 请求确实经过 Cloudflare，取 CF-Connecting-IP（Cloudflare 覆盖写入）；
 *    - 否则它就是直连进来的对端 → 直接用它；
 * 3. 都没有（本地开发、测试）→ socket 对端。
 *
 * 已知的剩余风险：如果有人绕过 Cloudflare 直连 Railway 域名，且 Railway 不往 X-Forwarded-For 追加对端，
 * 那么最右一项可以伪造。这只影响限流的精度，不影响鉴权本身。
 */

// https://www.cloudflare.com/ips-v4 / ips-v6（2026-10 列表）
const CLOUDFLARE_V4: Array<[string, number]> = [
  ["173.245.48.0", 20],
  ["103.21.244.0", 22],
  ["103.22.200.0", 22],
  ["103.31.4.0", 22],
  ["141.101.64.0", 18],
  ["108.162.192.0", 18],
  ["190.93.240.0", 20],
  ["188.114.96.0", 20],
  ["197.234.240.0", 22],
  ["198.41.128.0", 17],
  ["162.158.0.0", 15],
  ["104.16.0.0", 13],
  ["104.24.0.0", 14],
  ["172.64.0.0", 13],
  ["131.0.72.0", 22],
];
const CLOUDFLARE_V6: Array<[string, number]> = [
  ["2400:cb00::", 32],
  ["2606:4700::", 32],
  ["2803:f800::", 32],
  ["2405:b500::", 32],
  ["2405:8100::", 32],
  ["2a06:98c0::", 29],
  ["2c0f:f248::", 32],
];

const cloudflare = new net.BlockList();
for (const [address, prefix] of CLOUDFLARE_V4) cloudflare.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of CLOUDFLARE_V6) cloudflare.addSubnet(address, prefix, "ipv6");

function normalizeIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
  return net.isIP(trimmed) ? trimmed : null;
}

export function isCloudflareIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;
  return cloudflare.check(normalized, net.isIPv6(normalized) ? "ipv6" : "ipv4");
}

type RequestLike = {
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string | undefined };
};

function headerValue(req: RequestLike, name: string): string | undefined {
  const raw = req.headers?.[name];
  if (Array.isArray(raw)) return typeof raw[0] === "string" ? raw[0] : undefined;
  return typeof raw === "string" ? raw : undefined;
}

export function clientIp(req: RequestLike, env: NodeJS.ProcessEnv = process.env): string {
  if (env.ADMIN_TRUSTED_PROXY_HOPS?.trim()) return requestIp(req, env);

  const forwarded = headerValue(req, "x-forwarded-for");
  const chain = (forwarded || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const nearest = normalizeIp(chain[chain.length - 1]);
  if (nearest) {
    if (isCloudflareIp(nearest)) {
      const viaCloudflare = normalizeIp(headerValue(req, "cf-connecting-ip"));
      if (viaCloudflare) return viaCloudflare;
    }
    return nearest;
  }
  return normalizeIp(req.socket?.remoteAddress) || req.socket?.remoteAddress || "unknown";
}
