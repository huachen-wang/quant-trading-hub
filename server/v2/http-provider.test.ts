import { afterEach, describe, expect, it, vi } from "vitest";
import { createDemoOverview, DEMO_STRATEGIES } from "./demo-data";
import { HttpQuantDataProvider } from "./http-provider";

function provider() {
  return new HttpQuantDataProvider({
    baseUrl: "https://quant-core.example.test/",
    apiKey: "test-key",
    timeoutMs: 1_000,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpQuantDataProvider", () => {
  it("validates overview responses and sends service authentication", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(createDemoOverview()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const overview = await provider().getOverview();

    expect(overview.strategies).toHaveLength(6);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://quant-core.example.test/v1/overview",
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("returns null for a missing strategy without inventing demo data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("not found", { status: 404 })),
    );

    await expect(provider().getStrategy("missing")).resolves.toBeNull();
  });

  it("rejects malformed live payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ ...DEMO_STRATEGIES[0], id: "" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(provider().listStrategies()).rejects.toBeTruthy();
  });
});
