import type {
  AllocationDraft,
  AllocationValidation,
  CoreStrategy,
  PlatformProfile,
  ValidationIssue,
} from "../../shared/v2/contracts";

export const ALLOCATION_RULE_SET_VERSION = "eaxau-allocation-2026.08.1";
const WEIGHT_TOLERANCE = 0.05;

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function total(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  path: string,
  message: string,
  remediation?: string,
): ValidationIssue {
  return { severity, code, path, message, remediation };
}

function riskBudgetFor(draft: AllocationDraft) {
  if (draft.riskBudget.maxDrawdownPct) return draft.riskBudget.maxDrawdownPct;
  if (draft.riskBudget.profile === "LOW") return 8;
  if (draft.riskBudget.profile === "HIGH") return 18;
  return 12;
}

export function validateAllocation(
  draft: AllocationDraft,
  platforms: PlatformProfile[],
  strategies: CoreStrategy[],
): AllocationValidation {
  const normalizedDraft: AllocationDraft = JSON.parse(JSON.stringify(draft));
  const issues: ValidationIssue[] = [];
  const platformById = new Map(platforms.map((platform) => [platform.id, platform]));
  const strategyById = new Map(strategies.map((strategy) => [strategy.id, strategy]));
  const capital = Number(draft.capital.amount);
  const platformConcentrationPct: Record<string, number> = {};
  const strategyConcentrationPct: Record<string, number> = {};
  const termsVersions: Record<string, string> = {};
  let modeledDrawdownPct = 0;

  const platformIds = draft.platformBuckets.map((bucket) => bucket.platformId);
  const duplicatePlatform = platformIds.find(
    (id, index) => platformIds.indexOf(id) !== index,
  );
  if (duplicatePlatform) {
    issues.push(
      issue(
        "ERROR",
        "DUPLICATE_PLATFORM",
        "platformBuckets",
        "同一平台不能建立多个资金桶。",
        "合并重复平台并重新分配权重。",
      ),
    );
  }

  const platformWeight = total(
    draft.platformBuckets.map((bucket) => bucket.capitalWeightPct),
  );
  if (Math.abs(platformWeight - 100) > WEIGHT_TOLERANCE) {
    issues.push(
      issue(
        "ERROR",
        "PLATFORM_WEIGHT_TOTAL",
        "platformBuckets",
        `平台资金权重当前为 ${round(platformWeight)}%，必须等于 100%。`,
        "调整各平台资金权重。",
      ),
    );
  }

  draft.platformBuckets.forEach((bucket, bucketIndex) => {
    const path = `platformBuckets.${bucketIndex}`;
    const platform = platformById.get(bucket.platformId);
    platformConcentrationPct[bucket.platformId] = round(bucket.capitalWeightPct);

    if (!platform) {
      issues.push(
        issue(
          "ERROR",
          "UNKNOWN_PLATFORM",
          `${path}.platformId`,
          "所选平台不存在或已下架。",
          "重新选择可用平台。",
        ),
      );
      return;
    }

    termsVersions[platform.id] = platform.commercialTerms.version;
    const bucketCapital = (capital * bucket.capitalWeightPct) / 100;
    if (bucketCapital + 0.01 < platform.minimumCapital) {
      issues.push(
        issue(
          "ERROR",
          "PLATFORM_MINIMUM_CAPITAL",
          `${path}.capitalWeightPct`,
          `${platform.name} 分配资金约 ${round(bucketCapital).toLocaleString("zh-CN")} ${draft.capital.currency}，低于平台模拟门槛 ${platform.minimumCapital.toLocaleString("zh-CN")}。`,
          "提高该平台权重或减少平台数量。",
        ),
      );
    }

    if (bucket.capitalWeightPct > 65) {
      issues.push(
        issue(
          "WARNING",
          "PLATFORM_CONCENTRATION",
          `${path}.capitalWeightPct`,
          `${platform.name} 占组合 ${bucket.capitalWeightPct}%，平台集中度较高。`,
          "考虑加入第二个平台分散运营与连接风险。",
        ),
      );
    }

    if (platform.source.freshness !== "FRESH") {
      issues.push(
        issue(
          "WARNING",
          "STALE_COMMERCIAL_TERMS",
          `${path}.platformId`,
          `${platform.name} 的成本或出金样本不是最新状态。`,
          "提交前联系运营复核当前规则版本。",
        ),
      );
    }

    const strategyWeight = total(
      bucket.strategies.map((strategy) => strategy.weightPct),
    );
    if (Math.abs(strategyWeight - 100) > WEIGHT_TOLERANCE) {
      issues.push(
        issue(
          "ERROR",
          "STRATEGY_WEIGHT_TOTAL",
          `${path}.strategies`,
          `${platform.name} 桶内策略权重为 ${round(strategyWeight)}%，必须等于 100%。`,
          "调整桶内策略权重。",
        ),
      );
    }

    const seenStrategies = new Set<string>();
    bucket.strategies.forEach((allocation, strategyIndex) => {
      const strategyPath = `${path}.strategies.${strategyIndex}`;
      const strategy = strategyById.get(allocation.strategyId);
      if (seenStrategies.has(allocation.strategyId)) {
        issues.push(
          issue(
            "ERROR",
            "DUPLICATE_STRATEGY_IN_BUCKET",
            strategyPath,
            "同一策略不能在一个平台桶内重复出现。",
          ),
        );
      }
      seenStrategies.add(allocation.strategyId);

      if (!strategy) {
        issues.push(
          issue(
            "ERROR",
            "UNKNOWN_STRATEGY",
            `${strategyPath}.strategyId`,
            "所选策略不存在或已下架。",
            "重新选择六个核心策略中的可用项。",
          ),
        );
        return;
      }

      if (!platform.supportedStrategyIds.includes(strategy.id)) {
        issues.push(
          issue(
            "ERROR",
            "INCOMPATIBLE_STRATEGY",
            `${strategyPath}.strategyId`,
            `${strategy.shortName} 当前不支持 ${platform.name}。`,
            "更换平台或移除该策略。",
          ),
        );
      }

      const globalWeight =
        (bucket.capitalWeightPct * allocation.weightPct) / 100;
      strategyConcentrationPct[strategy.id] = round(
        (strategyConcentrationPct[strategy.id] || 0) + globalWeight,
      );
      const strategyCapital = (capital * globalWeight) / 100;
      if (strategyCapital + 0.01 < strategy.minimumCapital) {
        issues.push(
          issue(
            "WARNING",
            "STRATEGY_MINIMUM_CAPITAL",
            `${strategyPath}.weightPct`,
            `${strategy.shortName} 的模拟分配资金约 ${round(strategyCapital).toLocaleString("zh-CN")} ${draft.capital.currency}，低于建议门槛 ${strategy.minimumCapital.toLocaleString("zh-CN")}。`,
            "提高资金或策略权重，并由运营复核参数。",
          ),
        );
      }

      if (strategy.source.freshness === "OFFLINE") {
        issues.push(
          issue(
            "ERROR",
            "STRATEGY_OFFLINE",
            `${strategyPath}.strategyId`,
            `${strategy.shortName} 当前数据离线，不能进入待确认方案。`,
            "等待数据恢复或移除该策略。",
          ),
        );
      } else if (strategy.source.freshness === "STALE") {
        issues.push(
          issue(
            "WARNING",
            "STRATEGY_STALE",
            `${strategyPath}.strategyId`,
            `${strategy.shortName} 数据已过新鲜度阈值。`,
            "提交前核验最近同步时间。",
          ),
        );
      }

      const drawdown = strategy.metrics.maxDrawdownPct ?? strategy.riskScore * 3;
      modeledDrawdownPct +=
        (globalWeight / 100) * drawdown * allocation.riskMultiplier;
    });
  });

  Object.entries(strategyConcentrationPct).forEach(([strategyId, weight]) => {
    const strategy = strategyById.get(strategyId);
    if (weight > 60) {
      issues.push(
        issue(
          weight > 80 ? "ERROR" : "WARNING",
          "STRATEGY_CONCENTRATION",
          "platformBuckets",
          `${strategy?.shortName ?? strategyId} 占组合 ${round(weight)}%，单策略集中度较高。`,
          "增加不同逻辑的策略或降低该策略权重。",
        ),
      );
    }
  });

  modeledDrawdownPct = round(modeledDrawdownPct);
  const drawdownBudget = riskBudgetFor(draft);
  if (modeledDrawdownPct > drawdownBudget) {
    issues.push(
      issue(
        "ERROR",
        "RISK_BUDGET_EXCEEDED",
        "riskBudget",
        `模型回撤 ${modeledDrawdownPct}% 超过当前预算 ${drawdownBudget}%。`,
        "降低风险倍率、减少高风险策略或提高风险预算后重新确认。",
      ),
    );
  } else if (modeledDrawdownPct > drawdownBudget * 0.8) {
    issues.push(
      issue(
        "WARNING",
        "RISK_BUDGET_NEAR_LIMIT",
        "riskBudget",
        `模型回撤已使用风险预算的 ${round((modeledDrawdownPct / drawdownBudget) * 100)}%。`,
      ),
    );
  }

  if (draft.dataMode === "DEMO") {
    issues.push(
      issue(
        "INFO",
        "DEMO_DATA",
        "dataMode",
        "当前方案使用模拟策略数据和模拟平台条款，不能用于真实开户或资金决策。",
      ),
    );
  }

  const estimatedCosts = round(capital * 0.006);
  return {
    valid: !issues.some((item) => item.severity === "ERROR"),
    normalizedDraft,
    issues,
    estimated: {
      annualizedKnownCosts: {
        amount: estimatedCosts.toFixed(2),
        currency: draft.capital.currency,
      },
      platformConcentrationPct,
      strategyConcentrationPct,
      modeledDrawdownPct,
    },
    ruleSetVersion: ALLOCATION_RULE_SET_VERSION,
    termsVersions,
    dataMode: draft.dataMode,
  };
}
