import {
  accountSchema,
  allocationDraftSchema,
  coreStrategySchema,
  overviewSchema,
  platformSchema,
  type AllocationRequest,
} from "../../shared/v2/contracts";
import type { QuantDataProvider } from "./provider";

type HttpProviderOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
};

export class HttpQuantDataProvider implements QuantDataProvider {
  readonly kind = "HTTP" as const;
  private readonly baseUrl: string;

  constructor(private readonly options: HttpProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  private async request(path: string, init?: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          ...(this.options.apiKey
            ? { authorization: `Bearer ${this.options.apiKey}` }
            : {}),
          ...init?.headers,
        },
      });
      if (!response.ok) {
        throw new Error(`Quant Data Core ${response.status}: ${path}`);
      }
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async getOverview() {
    return overviewSchema.parse(await this.request("/v1/overview"));
  }

  async listStrategies() {
    return coreStrategySchema.array().parse(await this.request("/v1/strategies"));
  }

  async getStrategy(id: string) {
    try {
      return coreStrategySchema.parse(
        await this.request(`/v1/strategies/${encodeURIComponent(id)}`),
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes(" 404:")) return null;
      throw error;
    }
  }

  async listPlatforms() {
    return platformSchema.array().parse(await this.request("/v1/platforms"));
  }

  async listAccounts() {
    return accountSchema.array().parse(await this.request("/v1/accounts"));
  }

  async getAccount(id: string) {
    try {
      return accountSchema.parse(
        await this.request(`/v1/accounts/${encodeURIComponent(id)}/snapshot`),
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes(" 404:")) return null;
      throw error;
    }
  }

  async recommendAllocation(input: AllocationRequest) {
    return allocationDraftSchema.parse(
      await this.request("/v1/allocation/recommendations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  }
}
