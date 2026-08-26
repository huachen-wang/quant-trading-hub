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
  getAllianceBrokers,
  getRiskOptions,
  type AllianceBrokerId,
  type FundingPath,
  type OnboardingMode,
  type RiskProfile,
} from "@/components/v2/configurator/types";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import type { CoreStrategy } from "@/shared/v2/contracts";

type SolutionConfiguratorProps = {
  strategies: CoreStrategy[];
};

export function SolutionConfigurator({
  strategies,
}: SolutionConfiguratorProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 1020;
  const isMobile = width < 680;
  const { language } = useLanguage();
  const riskOptions = getRiskOptions(language);
  const allianceBrokers = getAllianceBrokers(language);
  const [capital, setCapital] = useState("50000");
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("MEDIUM");
  const [brokerIds, setBrokerIds] = useState<AllianceBrokerId[]>(["exness"]);
  const [onboardingMode, setOnboardingMode] =
    useState<OnboardingMode>("SELF_OPENED");
  const [fundingPath, setFundingPath] = useState<FundingPath>("BROKER_DIRECT");
  const [generatedSignature, setGeneratedSignature] = useState("");
  const capabilities = trpc.v2.managedSessions.capabilities.useQuery(
    undefined,
    {
      staleTime: 60_000,
    },
  );

  const numericCapital = Number(capital) || 0;
  const riskOption = riskOptions.find((item) => item.id === riskProfile)!;
  const brokers = allianceBrokers.filter((item) => brokerIds.includes(item.id));
  const capabilityBrokers = (
    capabilities.data as
      | {
          brokers?: {
            id: string;
            collectionApproval?:
              | "NOT_APPROVED"
              | "PENDING"
              | "APPROVED"
              | "SUSPENDED";
            collectionOperational?: boolean;
          }[];
        }
      | undefined
  )?.brokers;
  const collectionApprovals = Object.fromEntries(
    allianceBrokers.map((broker) => {
      const capability = capabilityBrokers?.find(
        (item) => item.id === broker.id,
      );
      const approval = capability?.collectionApproval ?? "PENDING";
      return [
        broker.id,
        approval === "APPROVED" && capability?.collectionOperational !== true
          ? "PENDING"
          : approval,
      ];
    }),
  ) as Record<
    AllianceBrokerId,
    "NOT_APPROVED" | "PENDING" | "APPROVED" | "SUSPENDED"
  >;
  const strategyIds = useMemo(
    () => strategies.map((strategy) => strategy.id),
    [strategies],
  );
  const signature = [
    capital,
    riskProfile,
    [...brokerIds].sort().join(","),
    onboardingMode,
    fundingPath,
    strategyIds.join(","),
  ].join("|");
  const generated = generatedSignature === signature;
  const canGenerate =
    numericCapital > 0 && strategies.length > 0 && brokerIds.length > 0;

  const changeOnboardingMode = (mode: OnboardingMode) => {
    setOnboardingMode(mode);
    if (mode === "SELF_OPENED") setFundingPath("BROKER_DIRECT");
  };

  const toggleBroker = (nextBrokerId: AllianceBrokerId) => {
    setBrokerIds((current) => {
      if (current.includes(nextBrokerId)) {
        return current.length === 1
          ? current
          : current.filter((id) => id !== nextBrokerId);
      }
      return current.length >= 3 ? current : [...current, nextBrokerId];
    });
    setFundingPath("BROKER_DIRECT");
  };

  const openOnboarding = () => {
    router.push({
      pathname: "/v2-preview/allocate",
      params: {
        strategyIds: strategyIds.join(","),
        capital: String(Math.round(numericCapital * 100) / 100),
        risk: riskProfile,
        brokerIds: brokerIds.join(","),
        onboardingMode,
        fundsRoute: fundingPath,
      },
    } as never);
  };

  return (
    <View style={styles.section}>
      <ConfiguratorHeading
        isMobile={isMobile}
        selectedStrategyCount={strategies.length}
      />
      <ConfiguratorFormula
        capital={numericCapital}
        riskOption={riskOption}
        strategyCount={strategies.length}
        brokers={brokers}
        onboardingMode={onboardingMode}
        fundingPath={fundingPath}
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
          brokerIds={brokerIds}
          onToggleBroker={toggleBroker}
          onboardingMode={onboardingMode}
          onOnboardingModeChange={changeOnboardingMode}
          fundingPath={fundingPath}
          onFundingPathChange={setFundingPath}
          collectionApprovals={collectionApprovals}
        />
        <SolutionSummary
          isNarrow={isNarrow}
          numericCapital={numericCapital}
          riskOption={riskOption}
          strategies={strategies}
          brokers={brokers}
          onboardingMode={onboardingMode}
          fundingPath={fundingPath}
          generated={generated}
          canGenerate={canGenerate}
          onGenerate={() => setGeneratedSignature(signature)}
          onContinue={openOnboarding}
        />
      </View>
    </View>
  );
}
