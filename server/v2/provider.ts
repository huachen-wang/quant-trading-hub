import type {
  AllocationDraft,
  AllocationRequest,
  CoreStrategy,
  PlatformProfile,
  ServiceAccount,
  V2Overview,
} from "../../shared/v2/contracts";
import {
  createDemoOverview,
  DEFAULT_ALLOCATION,
  DEMO_ACCOUNTS,
  DEMO_PLATFORMS,
  DEMO_STRATEGIES,
} from "./demo-data";
import { buildSelectionAwareAllocation } from "./allocation-recommendation";
import { HttpQuantDataProvider } from "./http-provider";
import { NiubangQuantDataProvider } from "./niubang-provider";

export interface QuantDataProvider {
  readonly kind: "DEMO" | "HTTP" | "NIUBANG";
  getOverview(): Promise<V2Overview>;
  listStrategies(): Promise<CoreStrategy[]>;
  getStrategy(id: string): Promise<CoreStrategy | null>;
  listPlatforms(): Promise<PlatformProfile[]>;
  listAccounts(): Promise<ServiceAccount[]>;
  getAccount(id: string): Promise<ServiceAccount | null>;
  recommendAllocation(input: AllocationRequest): Promise<AllocationDraft>;
}

export class DemoQuantDataProvider implements QuantDataProvider {
  readonly kind = "DEMO" as const;

  async getOverview() {
    return createDemoOverview();
  }

  async listStrategies() {
    return DEMO_STRATEGIES;
  }

  async getStrategy(id: string) {
    return DEMO_STRATEGIES.find((strategy) => strategy.id === id) ?? null;
  }

  async listPlatforms() {
    return DEMO_PLATFORMS;
  }

  async listAccounts() {
    return DEMO_ACCOUNTS;
  }

  async getAccount(id: string) {
    return DEMO_ACCOUNTS.find((account) => account.id === id) ?? null;
  }

  async recommendAllocation(input: AllocationRequest) {
    const capital = Number(input.capital.amount);
    const template =
      input.riskProfile === "LOW" || capital < 18_000
        ? [
            {
              platformId: "ic-markets",
              capitalWeightPct: 100,
              strategies: [
                {
                  strategyId: "quantum-queen",
                  weightPct: 60,
                  riskMultiplier: 0.65,
                },
                {
                  strategyId: "night-hunter",
                  weightPct: 40,
                  riskMultiplier: 0.6,
                },
              ],
            },
          ]
        : capital < 40_000
          ? [
              {
                platformId: "exness",
                capitalWeightPct: 55,
                strategies: [
                  {
                    strategyId: "jingge-v51",
                    weightPct: 60,
                    riskMultiplier: 0.85,
                  },
                  {
                    strategyId: "night-hunter",
                    weightPct: 40,
                    riskMultiplier: 0.7,
                  },
                ],
              },
              {
                platformId: "ic-markets",
                capitalWeightPct: 45,
                strategies: [
                  {
                    strategyId: "quantum-queen",
                    weightPct: 100,
                    riskMultiplier: 0.75,
                  },
                ],
              },
            ]
          : DEFAULT_ALLOCATION.platformBuckets;

    return buildSelectionAwareAllocation({
      request: input,
      base: {
        ...DEFAULT_ALLOCATION,
        platformBuckets: template,
      },
      strategies: DEMO_STRATEGIES,
      platforms: DEMO_PLATFORMS,
      idPrefix: "demo",
    });
  }
}

let provider: QuantDataProvider | undefined;

function providerTimeoutMs() {
  const configured = Number(process.env.QUANT_DATA_CORE_TIMEOUT_MS || 8_000);
  if (!Number.isFinite(configured) || configured < 500) return 8_000;
  return Math.min(configured, 30_000);
}

function niubangStrategyMap() {
  const raw = process.env.NIUBANG_STRATEGY_MAP?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch (error) {
    console.error("[v2-provider] invalid NIUBANG_STRATEGY_MAP:", error);
    return {};
  }
}

export function getV2Provider(): QuantDataProvider {
  if (provider) return provider;

  const baseUrl = process.env.QUANT_DATA_CORE_URL?.trim();
  const niubangUrl = process.env.NIUBANG_DATA_URL?.trim();
  const selected = process.env.V2_DATA_PROVIDER?.trim().toUpperCase();

  if (selected === "DEMO") {
    provider = new DemoQuantDataProvider();
  } else if (selected === "NIUBANG") {
    if (!niubangUrl) {
      console.warn(
        "[v2-provider] V2_DATA_PROVIDER=NIUBANG but NIUBANG_DATA_URL is empty; using demo data.",
      );
      provider = new DemoQuantDataProvider();
    } else {
      provider = new NiubangQuantDataProvider({
        baseUrl: niubangUrl,
        apiKey: process.env.NIUBANG_DATA_API_KEY?.trim(),
        timeoutMs: providerTimeoutMs(),
        strategyMap: niubangStrategyMap(),
      });
    }
  } else if (selected === "HTTP") {
    if (!baseUrl) {
      console.warn(
        "[v2-provider] V2_DATA_PROVIDER=HTTP but QUANT_DATA_CORE_URL is empty; using demo data.",
      );
      provider = new DemoQuantDataProvider();
    } else {
      provider = new HttpQuantDataProvider({
        baseUrl,
        apiKey: process.env.QUANT_DATA_CORE_API_KEY?.trim(),
        timeoutMs: providerTimeoutMs(),
      });
    }
  } else if (selected) {
    console.warn(
      `[v2-provider] unsupported V2_DATA_PROVIDER=${selected}; using demo data.`,
    );
    provider = new DemoQuantDataProvider();
  } else if (niubangUrl) {
    provider = new NiubangQuantDataProvider({
      baseUrl: niubangUrl,
      apiKey: process.env.NIUBANG_DATA_API_KEY?.trim(),
      timeoutMs: providerTimeoutMs(),
      strategyMap: niubangStrategyMap(),
    });
  } else if (baseUrl) {
    provider = new HttpQuantDataProvider({
      baseUrl,
      apiKey: process.env.QUANT_DATA_CORE_API_KEY?.trim(),
      timeoutMs: providerTimeoutMs(),
    });
  } else {
    provider = new DemoQuantDataProvider();
  }
  return provider!;
}

export function resetV2ProviderForTests() {
  provider = undefined;
}
