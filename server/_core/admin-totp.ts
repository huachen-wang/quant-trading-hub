import crypto from "node:crypto";

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.toUpperCase().replace(/[\s=-]/g, "");
  if (!normalized || [...normalized].some((char) => !alphabet.includes(char))) {
    throw new Error("ADMIN_TOTP_SECRET_BASE32 格式无效");
  }
  let bits = "";
  for (const char of normalized) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  const decoded = Buffer.from(bytes);
  if (decoded.length < 20) {
    throw new Error(
      "ADMIN_TOTP_SECRET_BASE32 解码后至少需要 20 bytes (160 bit)",
    );
  }
  return decoded;
}

export function computeAdminTotp(
  secretBase32: string,
  now = new Date(),
  stepOffset = 0,
) {
  const counter = BigInt(Math.floor(now.getTime() / 1000 / 30) + stepOffset);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = crypto
    .createHmac("sha1", decodeBase32(secretBase32))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function isAdminTotpConfigured(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.ADMIN_TOTP_SECRET_BASE32?.trim();
  if (!secret) return false;
  decodeBase32(secret);
  return true;
}

export function verifyAdminTotp(
  code: string,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
) {
  return matchAdminTotpStep(code, env, now) !== null;
}

export function matchAdminTotpStep(
  code: string,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
) {
  const secret = env.ADMIN_TOTP_SECRET_BASE32?.trim();
  if (!secret || !/^\d{6}$/.test(code)) return null;
  const submitted = Buffer.from(code);
  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(computeAdminTotp(secret, now, offset));
    if (
      expected.length === submitted.length &&
      crypto.timingSafeEqual(expected, submitted)
    ) {
      return Math.floor(now.getTime() / 1000 / 30) + offset;
    }
  }
  return null;
}
