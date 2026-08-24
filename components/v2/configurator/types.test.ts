import { describe, expect, it } from "vitest";
import {
  FUNDING_ROUTE_OPTIONS,
  SESSION_DURATION_OPTIONS,
  exitModeLabel,
  fundingRouteLabel,
} from "./types";

describe("managed session configurator options", () => {
  it("supports 30, 90 and 180 day sessions", () => {
    expect(SESSION_DURATION_OPTIONS.map((option) => option.id)).toEqual([
      30, 90, 180,
    ]);
  });

  it("distinguishes the active broker route from the preparing vault route", () => {
    expect(FUNDING_ROUTE_OPTIONS).toMatchObject([
      { id: "DIRECT_BROKER", status: "ACTIVE" },
      { id: "MANAGED_VAULT", status: "PREPARING" },
    ]);
  });

  it("labels direct, vault and mixed USDT routes", () => {
    expect(fundingRouteLabel(["DIRECT_BROKER"])).toBe("U 直达券商");
    expect(fundingRouteLabel(["MANAGED_VAULT"])).toBe("Managed Vault");
    expect(fundingRouteLabel(["DIRECT_BROKER", "MANAGED_VAULT"])).toBe(
      "混合路由",
    );
  });

  it("keeps all three exit instructions explicit", () => {
    expect(exitModeLabel("CLOSE_NOW")).toBe("立即平仓");
    expect(exitModeLabel("NO_NEW_ENTRIES")).toBe("自然退出");
    expect(exitModeLabel("HAND_BACK_POSITIONS")).toBe("交还持仓");
  });
});
