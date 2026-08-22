import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { ConfiguratorControls } from "@/components/v2/configurator/controls";
import {
  ConfiguratorFormula,
  ConfiguratorHeading,
} from "@/components/v2/configurator/formula";
import { styles } from "@/components/v2/configurator/styles";
import { SolutionSummary } from "@/components/v2/configurator/summary";
import {
  RISK_OPTIONS,
  type RiskProfile,
  type ServicePath,
} from "@/components/v2/configurator/types";
import { trpc } from "@/lib/trpc";
import type {
  AllocationDraft,
  CoreStrategy,
  PlatformProfile,
} from "@/shared/v2/contracts";

type SolutionConfiguratorProps = {
  strategies: CoreStrategy[];
  platforms: PlatformProfile[];
  selectedStrategyIds: string[];
  onToggleStrategy: (strategyId: string) => void;
};

export function SolutionConfigurator({
  strategies,
  platforms,
  selectedStrategyIds,
  onToggleStrategy,
}: SolutionConfiguratorProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 1020;
  const isMobile = width < 680;
  const [capital, setCapital] = useState("50000");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("MEDIUM");
  const [servicePath, setServicePath] = useState<ServicePath>("BROKER");
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<string[]>(() =>
    platforms.slice(0, 2).map((platform) => platform.id),
  );
  const [generatedDraft, setGeneratedDraft] = useState<AllocationDraft>();
  const [generatedSignature, setGeneratedSignature] = useState("");

  const recommendation = trpc.v2.allocation.recommend.useMutation();
  const validation = trpc.v2.allocation.validate.useMutation();
  const selectedStrategies = useMemo(
    () =>
      strategies.filter((strategy) =>
        selectedStrategyIds.includes(strategy.id),
      ),
    [selectedStrategyIds, strategies],
  );
  const selectedPlatforms = useMemo(
    () =>
      platforms.filter((platform) => selectedPlatformIds.includes(platform.id)),
    [platforms, selectedPlatformIds],
  );
  const signature = [
    capital,
    riskProfile,
    servicePath,
    [...selectedStrategyIds].sort().join(","),
    [...selectedPlatformIds].sort().join(","),
  ].join("|");
  const riskOption = RISK_OPTIONS.find((item) => item.id === riskProfile)!;
  const numericCapital = Number(capital) || 0;
  const missingCompatibility = selectedStrategies.filter(
    (strategy) =>
      !selectedPlatforms.some((platform) =>
        platform.supportedStrategyIds.includes(strategy.id),
      ),
  );
  const unusedSelectedPlatforms = selectedPlatforms.filter(
    (platform) =>
      !selectedStrategies.some((strategy) =>
        platform.supportedStrategyIds.includes(strategy.id),
      ),
  );
  const selectedOffline = selectedStrategies.some(
    (strategy) => strategy.source.freshness === "OFFLINE",
  );
  const generatedIsCurrent =
    Boolean(generatedDraft) && generatedSignature === signature;
  const generatedErrors =
    generatedIsCurrent && !validation.isPending
      ? (validation.data?.issues.filter(
          (issue) => issue.severity === "ERROR",
        ) ?? [])
      : [];
  const generatedWarnings =
    generatedIsCurrent && !validation.isPending
      ? (validation.data?.issues.filter(
          (issue) => issue.severity === "WARNING",
        ) ?? [])
      : [];
  const canGenerate =
    numericCapital > 0 &&
    selectedStrategies.length > 0 &&
    selectedPlatforms.length > 0 &&
    missingCompatibility.length === 0 &&
    unusedSelectedPlatforms.length === 0 &&
    !selectedOffline &&
    !recommendation.isPending &&
    !validation.isPending;

  const togglePlatform = (platformId: string) => {
    setSelectedPlatformIds((current) => {
      if (current.includes(platformId)) {
        return current.filter((id) => id !== platformId);
      }
      if (current.length >= 3) return current;
      return [...current, platformId];
    });
  };

  const generateSolution = () => {
    if (!canGenerate) return;
    const requestedSignature = signature;
    recommendation.mutate(
      {
        capital: {
          amount: String(Math.round(numericCapital * 100) / 100),
          currency: "USD",
        },
        riskProfile,
        platformIds: selectedPlatformIds,
        strategyIds: selectedStrategyIds,
      },
      {
        onSuccess: (draft) => {
          setGeneratedDraft(draft);
          setGeneratedSignature(requestedSignature);
          validation.mutate(draft);
        },
      },
    );
  };

  const openAdvancedAllocation = () => {
    router.push({
      pathname: "/v2-preview/allocate",
      params: {
        strategyIds: selectedStrategyIds.join(","),
        platformIds: selectedPlatformIds.join(","),
        capital: String(Math.round(numericCapital)),
        risk: riskProfile,
      },
    } as never);
  };

  return (
    <View style={styles.section}>
      <ConfiguratorHeading
        isMobile={isMobile}
        selectedStrategyCount={selectedStrategies.length}
      />
      <ConfiguratorFormula
        capital={numericCapital}
        riskOption={riskOption}
        strategyCount={selectedStrategies.length}
        platformCount={selectedPlatforms.length}
        servicePath={servicePath}
      />
      <View
        style={[styles.configurator, isNarrow && styles.configuratorNarrow]}
      >
        <ConfiguratorControls
          isMobile={isMobile}
          capital={capital}
          numericCapital={numericCapital}
          onCapitalChange={setCapital}
          riskProfile={riskProfile}
          onRiskProfileChange={setRiskProfile}
          strategies={strategies}
          selectedStrategyIds={selectedStrategyIds}
          onToggleStrategy={onToggleStrategy}
          platforms={platforms}
          selectedPlatformIds={selectedPlatformIds}
          onTogglePlatform={togglePlatform}
          servicePath={servicePath}
          onServicePathChange={setServicePath}
        />
        <SolutionSummary
          isNarrow={isNarrow}
          numericCapital={numericCapital}
          riskOption={riskOption}
          selectedStrategies={selectedStrategies}
          selectedPlatforms={selectedPlatforms}
          allPlatforms={platforms}
          servicePath={servicePath}
          missingCompatibility={missingCompatibility}
          unusedSelectedPlatforms={unusedSelectedPlatforms}
          generatedIsCurrent={generatedIsCurrent}
          generatedDraft={generatedDraft}
          validationData={validation.data}
          isValidating={validation.isPending}
          generatedErrorCount={generatedErrors.length}
          generatedWarningCount={generatedWarnings.length}
          canGenerate={canGenerate}
          isGenerating={recommendation.isPending}
          onGenerate={generateSolution}
          onAdvanced={openAdvancedAllocation}
        />
      </View>
    </View>
  );
}
