import crypto from "node:crypto";

const FAILURE_WINDOW_MS = 5 * 60_000;
const LOCK_MS = 15 * 60_000;
const MAX_FAILURES = 5;

type Attempt = {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
};

// MVP is deployed as one server process. This limiter deliberately stores only
// hashes and never codes/passwords. Move this interface to Redis/DB before
// horizontal scaling so lockouts remain shared across instances.
const attempts = new Map<string, Attempt>();

function digest(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function keys(scope: string, principal: string, ip: string) {
  const principalHash = digest(principal);
  return [
    `${scope}:${principalHash}:GLOBAL`,
    `${scope}:${principalHash}:${digest(ip || "unknown")}`,
  ];
}

export function requestIp(req: {
  headers?: Record<string, unknown>;
  socket?: { remoteAddress?: string | undefined };
}, env: NodeJS.ProcessEnv = process.env) {
  const socketAddress = req.socket?.remoteAddress || "unknown";
  const trustedProxyHops = Number.parseInt(
    env.ADMIN_TRUSTED_PROXY_HOPS?.trim() || "0",
    10,
  );
  // X-Forwarded-For is attacker-controlled unless the complete path from this
  // process to the edge is trusted. Default to the socket peer. When deployed
  // behind a known proxy chain, walk from the right (nearest trusted hop)
  // instead of trusting the user-supplied first value.
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1) {
    return socketAddress;
  }
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded !== "string") return socketAddress;
  const chain = forwarded
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!chain.length) return socketAddress;
  const candidateIndex = Math.max(0, chain.length - trustedProxyHops);
  return chain[candidateIndex] || socketAddress;
}

export function assertSecurityAttemptAllowed(
  scope: string,
  principal: string,
  ip: string,
  now = Date.now(),
) {
  for (const attemptKey of keys(scope, principal, ip)) {
    const entry = attempts.get(attemptKey);
    if (entry?.lockedUntil && entry.lockedUntil > now) {
      throw new Error("敏感验证失败次数过多，请 15 分钟后重试");
    }
  }
}

export function recordSecurityFailure(
  scope: string,
  principal: string,
  ip: string,
  now = Date.now(),
) {
  let lockedUntil = 0;
  for (const attemptKey of keys(scope, principal, ip)) {
    const existing = attempts.get(attemptKey);
    const current =
      !existing || now - existing.windowStartedAt > FAILURE_WINDOW_MS
        ? { failures: 0, windowStartedAt: now, lockedUntil: 0 }
        : existing;
    current.failures += 1;
    if (current.failures >= MAX_FAILURES) current.lockedUntil = now + LOCK_MS;
    attempts.set(attemptKey, current);
    lockedUntil = Math.max(lockedUntil, current.lockedUntil);
  }
  return lockedUntil;
}

export function clearSecurityFailures(
  scope: string,
  principal: string,
  ip: string,
) {
  for (const attemptKey of keys(scope, principal, ip)) {
    attempts.delete(attemptKey);
  }
}

export function resetSecurityThrottleForTests() {
  attempts.clear();
}
