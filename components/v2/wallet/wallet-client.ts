type ProviderRequest = {
  method: string;
  params?: unknown[];
};

export type InjectedProvider = {
  request<T = unknown>(request: ProviderRequest): Promise<T>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};

export function normalizeWalletAddress(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? value
    : null;
}

export async function requestWalletConnection(provider: InjectedProvider) {
  const accounts = await provider.request<string[]>({
    method: "eth_requestAccounts",
  });
  const address = normalizeWalletAddress(accounts[0]);
  if (!address) throw new Error("钱包没有返回可用地址");
  const chainId = await provider.request<string>({ method: "eth_chainId" });
  return { address, chainId };
}

export function shortWalletAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function walletNetworkLabel(chainId: string | null) {
  const labels: Record<string, string> = {
    "0x1": "Ethereum",
    "0x38": "BNB Chain",
    "0x89": "Polygon",
    "0xa4b1": "Arbitrum",
    "0x2105": "Base",
  };
  return chainId
    ? (labels[chainId.toLowerCase()] ?? `Chain ${chainId}`)
    : "网络待确认";
}
