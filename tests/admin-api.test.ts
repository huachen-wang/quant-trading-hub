import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

vi.mock("expo-linking", () => ({
  createURL: vi.fn(() => "app://callback"),
  canOpenURL: vi.fn(async () => true),
  openURL: vi.fn(async () => undefined),
}));

describe("Admin API Client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { localStorage?: Storage }).localStorage;
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  });

  it("adds X-Admin-Token header when token exists", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_BASE_URL", "https://example.test");
    globalThis.__DEV__ = false;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        result: { data: { json: { success: true } } },
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    globalThis.sessionStorage = {
      getItem: vi.fn(() => "admin-token-123"),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage;

    vi.resetModules();
    const { adminQuery } = await import("../lib/admin-api");

    await adminQuery("admin.stats.overview");

    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers["X-Admin-Token"]).toBe("admin-token-123");
  });
});
