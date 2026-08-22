import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  normalizeWalletAddress,
  requestWalletConnection,
  type InjectedProvider,
} from "./wallet-client";

const STORAGE_KEY = "eaxau:wallet-address";

function getProvider(): InjectedProvider | undefined {
  if (Platform.OS !== "web") return undefined;
  return (globalThis as typeof globalThis & { ethereum?: InjectedProvider })
    .ethereum;
}

function readStoredAddress() {
  try {
    return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function storeAddress(address: string | null) {
  try {
    if (address) globalThis.sessionStorage?.setItem(STORAGE_KEY, address);
    else globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // A wallet connection still works when browser storage is unavailable.
  }
}

export function useInjectedWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addressRef = useRef<string | null>(null);

  const commitAddress = useCallback((next: string | null) => {
    addressRef.current = next;
    setAddress(next);
    storeAddress(next);
  }, []);

  const refreshProvider = useCallback(() => {
    const provider = getProvider();
    setAvailable(Boolean(provider));
    return provider;
  }, []);

  useEffect(() => {
    const provider = refreshProvider();
    if (!provider) return;

    let active = true;
    const restore = async () => {
      try {
        const [accounts, currentChain] = await Promise.all([
          provider.request<string[]>({ method: "eth_accounts" }),
          provider.request<string>({ method: "eth_chainId" }),
        ]);
        if (!active) return;
        const stored = readStoredAddress()?.toLowerCase();
        const restored = accounts
          .map(normalizeWalletAddress)
          .find((item) => item?.toLowerCase() === stored);
        if (restored) commitAddress(restored);
        setChainId(currentChain);
      } catch {
        if (active) setError("暂时无法读取钱包状态");
      }
    };

    const handleAccounts = (...args: any[]) => {
      const accounts = Array.isArray(args[0]) ? args[0] : [];
      const next = normalizeWalletAddress(accounts[0]);
      if (!next) {
        commitAddress(null);
        return;
      }
      if (addressRef.current || readStoredAddress()) commitAddress(next);
    };
    const handleChain = (...args: any[]) => {
      if (typeof args[0] === "string") setChainId(args[0]);
    };

    void restore();
    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);
    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, [commitAddress, refreshProvider]);

  const connect = useCallback(async () => {
    const provider = refreshProvider();
    setError(null);
    if (!provider) {
      setError("未检测到浏览器钱包，请使用钱包内置浏览器或安装钱包扩展");
      return false;
    }

    setConnecting(true);
    try {
      const connected = await requestWalletConnection(provider);
      commitAddress(connected.address);
      setChainId(connected.chainId);
      return true;
    } catch (cause) {
      const message =
        cause instanceof Error && /reject|denied|cancel/i.test(cause.message)
          ? "你已取消钱包连接"
          : cause instanceof Error
            ? cause.message
            : "钱包连接失败";
      setError(message);
      return false;
    } finally {
      setConnecting(false);
    }
  }, [commitAddress, refreshProvider]);

  const disconnect = useCallback(() => {
    commitAddress(null);
    setError(null);
  }, [commitAddress]);

  return {
    address,
    chainId,
    available,
    connecting,
    error,
    connected: Boolean(address),
    connect,
    disconnect,
    refreshProvider,
  };
}
