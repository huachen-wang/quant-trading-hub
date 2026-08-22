import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNiubangPublicPulse,
  resetNiubangPublicPulseForTests,
} from "./niubang-public-pulse";

function signal(
  id: number,
  options: {
    observedAt: string;
    verified?: boolean;
    dataSource?: string;
    equity?: number;
    source?: string;
  },
) {
  return {
    id,
    slug: `signal-${id}`,
    name: `Signal ${id}`,
    type: "ea",
    brokerName: "Broker",
    isVerified: options.verified ?? true,
    dataSource: options.dataSource ?? "mt_readonly",
    metrics: {
      monthlyReturnPct: id,
      totalReturnPct: id * 10,
      maxDrawdownPct: 5,
      winRatePct: 60,
      accountEquityUsd: options.equity ?? 10_000 + id,
    },
    chartPoints: [
      {
        time: options.observedAt,
        equityValue: 10_000 + id,
        source: options.source ?? "live",
      },
    ],
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetNiubangPublicPulseForTests();
});

describe("Niubang public pulse", () => {
  it("keeps the six freshest verified read-only live accounts", async () => {
    const now = Date.now();
    const items = Array.from({ length: 8 }, (_, index) =>
      signal(index + 1, {
        observedAt: new Date(now - index * 60_000).toISOString(),
      }),
    );
    items.push(
      signal(20, {
        observedAt: new Date(now).toISOString(),
        verified: false,
      }),
      signal(21, {
        observedAt: new Date(now).toISOString(),
        dataSource: "manual",
      }),
      signal(22, {
        observedAt: new Date(now).toISOString(),
        equity: 0,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ result: { data: { json: { items } } } }),
            { status: 200 },
          ),
      ),
    );

    const pulse = await getNiubangPublicPulse();
    expect(pulse.items).toHaveLength(6);
    expect(pulse.items.map((item) => item.slug)).toEqual([
      "signal-1",
      "signal-2",
      "signal-3",
      "signal-4",
      "signal-5",
      "signal-6",
    ]);
    expect(pulse.source.provider).toBe("niubang.ai");
    expect(pulse.source.dataMode).toBe("LIVE");
  });

  it("fails closed without presenting fallback values as live", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("down"))),
    );

    const pulse = await getNiubangPublicPulse();
    expect(pulse.items).toEqual([]);
    expect(pulse.source.freshness).toBe("OFFLINE");
  });

  it("uses the newest live point and drops accounts that are no longer current", async () => {
    const recent = signal(1, {
      observedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    recent.chartPoints.push({
      time: new Date().toISOString(),
      equityValue: 12_000,
      source: "manual",
    });
    const expired = signal(2, {
      observedAt: new Date(Date.now() - 8 * 24 * 3_600_000).toISOString(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              result: { data: { json: { items: [recent, expired] } } },
            }),
            { status: 200 },
          ),
      ),
    );

    const pulse = await getNiubangPublicPulse();
    expect(pulse.items).toHaveLength(1);
    expect(pulse.items[0].slug).toBe("signal-1");
    expect(pulse.items[0].observedAt).toBe(recent.chartPoints[0].time);
    expect(pulse.source.freshness).toBe("FRESH");
  });

  it("expires an old successful snapshot instead of retaining it forever", async () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-08-01T00:00:00.000Z");
    vi.setSystemTime(startedAt);
    const item = signal(1, { observedAt: startedAt.toISOString() });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: { data: { json: { items: [item] } } },
          }),
          { status: 200 },
        ),
      )
      .mockRejectedValueOnce(new Error("down"));
    vi.stubGlobal("fetch", fetchMock);

    expect((await getNiubangPublicPulse()).items).toHaveLength(1);
    vi.setSystemTime(new Date("2026-08-09T00:00:01.000Z"));
    const expired = await getNiubangPublicPulse();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(expired.items).toEqual([]);
    expect(expired.source.freshness).toBe("OFFLINE");
  });
});
