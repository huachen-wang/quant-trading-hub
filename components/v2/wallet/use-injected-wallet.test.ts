import { describe, expect, it, vi } from "vitest";
import {
  normalizeWalletAddress,
  requestWalletConnection,
  shortWalletAddress,
  walletNetworkLabel,
} from "./wallet-client";
import type { InjectedProvider } from "./wallet-client";

const ADDRESS = "0x1111111111111111111111111111111111111111";

describe("injected wallet client", () => {
  it("requests the public address and active chain directly", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => {
      if (method === "eth_requestAccounts") return [ADDRESS];
      if (method === "eth_chainId") return "0x1";
      throw new Error(`unexpected method: ${method}`);
    });

    await expect(
      requestWalletConnection({ request } as InjectedProvider),
    ).resolves.toEqual({ address: ADDRESS, chainId: "0x1" });
    expect(request.mock.calls.map(([input]) => input.method)).toEqual([
      "eth_requestAccounts",
      "eth_chainId",
    ]);
  });

  it("rejects malformed addresses returned by an injected provider", async () => {
    const provider: InjectedProvider = {
      request: vi.fn(async () => [
        "not-an-address",
      ]) as InjectedProvider["request"],
    };

    await expect(requestWalletConnection(provider)).rejects.toThrow(
      "钱包没有返回可用地址",
    );
    expect(normalizeWalletAddress("0x1234")).toBeNull();
  });

  it("formats connected identity without exposing a private credential", () => {
    expect(shortWalletAddress(ADDRESS)).toBe("0x1111...1111");
    expect(walletNetworkLabel("0x1")).toBe("Ethereum");
    expect(walletNetworkLabel("0x38")).toBe("BNB Chain");
  });
});
