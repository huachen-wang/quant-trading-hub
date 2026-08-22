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
import { HttpQuantDataProvider } from "./http-provider";

export interface QuantDataProvider {
  readonly kind: "DEMO" | "HTTP";
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
              platformId: "meridian",
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
                platformId: "atlas-prime",
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
                platformId: "meridian",
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

    return {
      ...DEFAULT_ALLOCATION,
      id: `demo-${input.riskProfile.toLowerCase()}-${input.capital.amount}`,
      capital: input.capital,
      platformBuckets: template,
      riskBudget: {
        profile: input.riskProfile,
        maxDrawdownPct:
          input.riskProfile === "LOW"
            ? 8
            : input.riskProfile === "HIGH"
              ? 18
              : 12,
      },
    };
  }
}

let provider: QuantDataProvider | undefined;

function providerTimeoutMs() {
  const configured = Number(process.env.QUANT_DATA_CORE_TIMEOUT_MS || 8_000);
  if (!Number.isFinite(configured) || configured < 500) return 8_000;
  return Math.min(configured, 30_000);
}

export function getV2Provider(): QuantDataProvider {
  if (provider) return provider;

  const baseUrl = process.env.QUANT_DATA_CORE_URL?.trim();
  provider = baseUrl
    ? new HttpQuantDataProvider({
        baseUrl,
        apiKey: process.env.QUANT_DATA_CORE_API_KEY?.trim(),
        timeoutMs: providerTimeoutMs(),
      })
    : new DemoQuantDataProvider();
  return provider;
}

export function resetV2ProviderForTests() {
  provider = undefined;
}
