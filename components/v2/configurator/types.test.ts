import { describe, expect, it } from "vitest";
import {
  ALLIANCE_BROKERS,
  ASSISTED_FUNDING_STEPS,
  BROKER_FUNDING_STEPS,
  BROKER_FUNDING_WARNINGS,
  FUNDING_PATH_OPTIONS,
  ONBOARDING_OPTIONS,
  fundingPathLabel,
  onboardingModeLabel,
} from "./types";

describe("AI量化联盟前端产品约束", () => {
  it("只展示三家可选执行券商并使用公开 broker id", () => {
    expect(ALLIANCE_BROKERS.map((broker) => broker.id)).toEqual([
      "exness",
      "ic-markets",
      "blueberry-markets",
    ]);
    expect(ALLIANCE_BROKERS.map((broker) => broker.name)).toEqual([
      "Exness",
      "IC Markets",
      "Blueberry Markets",
    ]);
  });

  it("接入方式只有自主开户与平台协助", () => {
    expect(ONBOARDING_OPTIONS.map((option) => option.id)).toEqual([
      "SELF_OPENED",
      "PLATFORM_ASSISTED",
    ]);
    expect(onboardingModeLabel("SELF_OPENED")).toBe("客户自主开户");
    expect(onboardingModeLabel("PLATFORM_ASSISTED")).toBe("平台协助接入");
  });

  it("入金路线没有期限或 Vault 概念", () => {
    expect(FUNDING_PATH_OPTIONS.map((option) => option.id)).toEqual([
      "BROKER_DIRECT",
      "PLATFORM_COLLECTION",
    ]);
    expect(fundingPathLabel("BROKER_DIRECT")).toBe("U 直达本人券商");
    expect(fundingPathLabel("PLATFORM_COLLECTION")).toBe("平台专属地址代收");
  });

  it("两条入金路径压缩为五步并保留独立 txHash/到账核对", () => {
    expect(BROKER_FUNDING_STEPS).toHaveLength(5);
    expect(ASSISTED_FUNDING_STEPS).toHaveLength(5);
    expect(BROKER_FUNDING_STEPS.join(" ")).toContain("txHash");
    expect(ASSISTED_FUNDING_STEPS.join(" ")).toContain("外部企业钱包");
    expect(BROKER_FUNDING_WARNINGS.join(" ")).toContain("错链");
    expect(BROKER_FUNDING_WARNINGS.join(" ")).toContain("未到账");
  });
});
