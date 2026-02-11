import { webcrypto } from "node:crypto";

/**
 * jose depends on Web Crypto APIs. Some Node runtimes do not expose
 * globalThis.crypto by default, so we install a safe fallback.
 */
const g = globalThis as typeof globalThis & { crypto?: Crypto };

if (!g.crypto) {
  g.crypto = webcrypto as Crypto;
}

