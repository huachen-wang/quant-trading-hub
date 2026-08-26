import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
import { EmptyState } from "@/components/empty-state";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import {
  BROKER_FUNDING_NETWORKS,
  type BrokerFundingNetwork,
  type BrokerFundingStatus,
} from "@/shared/managed-sessions/contracts";

type StatusFilter = "ALL" | BrokerFundingStatus;
type RouteFilter = "ALL" | "BROKER_DIRECT" | "PLATFORM_COLLECTION";
type BrokerId = "exness" | "ic-markets" | "blueberry-markets";
type ApprovalStatus = "NOT_APPROVED" | "PENDING" | "APPROVED" | "SUSPENDED";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "ALL", label: "全部" },
  { id: "WAITING_ACCOUNT", label: "待账户/交易权核验" },
  { id: "WAITING_INSTRUCTIONS", label: "待入金指令" },
  { id: "TX_SUBMITTED", label: "待收款/核对" },
  { id: "RECEIVED", label: "待对账" },
  { id: "AWAITING_PAYOUT", label: "待动态验证转出" },
  { id: "PAYOUT_SUBMITTED", label: "待券商入账" },
  { id: "BROKER_CREDIT_PENDING", label: "券商确认中" },
  { id: "EXCEPTION", label: "异常/退款" },
  { id: "CREDITED", label: "已到账" },
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草案",
  WAITING_ACCOUNT: "待账户核验",
  WAITING_INSTRUCTIONS: "待入金指令",
  READY_TO_FUND: "待客户转账",
  TX_SUBMITTED: "已报 txHash",
  RECEIVED: "平台已收款",
  RECONCILED: "已对账",
  AWAITING_PAYOUT: "待动态验证转出",
  PAYOUT_SUBMITTED: "已登记转出",
  BROKER_CREDIT_PENDING: "券商确认中",
  CREDITED: "券商已到账",
  EXCEPTION: "异常/退款",
  CANCELLED: "已取消",
};

export default function BrokerFundingAdminPage() {
  const colors = useColors();
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [fundsRoute, setFundsRoute] = useState<RouteFilter>("ALL");
  const queue = trpc.v2.managedSessions.adminFundingQueue.useQuery({
    status: status === "ALL" ? undefined : status,
    fundsRoute: fundsRoute === "ALL" ? undefined : fundsRoute,
    limit: 200,
  });
  const capabilities = trpc.v2.managedSessions.capabilities.useQuery();
  const counts = useMemo(() => {
    const rows = queue.data ?? [];
    return {
      total: rows.length,
      direct: rows.filter((row) => row.fundsRoute === "BROKER_DIRECT").length,
      collection: rows.filter(
        (row) => row.fundsRoute === "PLATFORM_COLLECTION",
      ).length,
      exceptions: rows.filter((row) => row.status === "EXCEPTION").length,
    };
  }, [queue.data]);

  return (
    <AdminPageChrome
      eyebrow="AI量化联盟 · FUNDING OPERATIONS"
      title="券商入金与企业代收队列"
      subtitle="EA销售款、客户直充券商与资管代收三账隔离。平台代收不自动转币，转出须动态验证并在外部企业钱包完成。"
      metrics={[
        { label: "当前筛选", value: counts.total },
        { label: "券商直充", value: counts.direct, tone: "#60A5FA" },
        { label: "平台代收", value: counts.collection, tone: "#D8BC83" },
        { label: "异常/退款", value: counts.exceptions, tone: "#F87171" },
      ]}
    >
      <AdminSection title="USDT 收付款服务" meta="MANUAL / EXTERNAL WALLET">
        <View style={styles.serviceCard}>
          <View style={styles.serviceTopline}>
            <View>
              <Text style={styles.serviceEyebrow}>当前模式</Text>
              <Text style={styles.serviceTitle}>
                {capabilities.data?.custodyProvider.kind ?? "MANUAL"}
              </Text>
            </View>
            <View style={styles.manualPill}>
              <Text style={styles.manualPillText}>未开启自动转币</Text>
            </View>
          </View>
          <Text style={styles.serviceText}>
            BVNK/Cobo 凭据、钱包与 webhook 尚未在业务平台配置。当前由管理员动态验证后，
            前往外部企业钱包完成收付款，再回本站登记 txHash；本站不保存私钥或自动签名。
          </Text>
          <View style={styles.serviceLinks}>
            <ExternalLink label="开通 BVNK Sandbox" url="https://signup.sandbox.bvnk.com/create-dev-account" primary />
            <ExternalLink label="BVNK API Key 文档" url="https://docs.bvnk.com/bvnk/get-started/generate-api-keys/" />
            <ExternalLink label="Cobo Portal" url="https://portal.cobo.com/" />
            <ExternalLink label="Cobo WaaS 文档" url="https://www.cobo.com/developers/v2/guides/get-started/get-started-with-waas" />
          </View>
        </View>
      </AdminSection>

      <CollectionApprovalControls />

      <AdminSection title="队列筛选" meta="BROKER FUNDING / COLLECTION">
        <View style={styles.filters}>
          <View style={styles.filterGroup}>
            {(["ALL", "BROKER_DIRECT", "PLATFORM_COLLECTION"] as const).map(
              (item) => (
                <FilterChip
                  key={item}
                  active={fundsRoute === item}
                  label={
                    item === "ALL"
                      ? "全部路线"
                      : item === "BROKER_DIRECT"
                        ? "券商直充"
                        : "平台专属地址代收"
                  }
                  onPress={() => setFundsRoute(item)}
                />
              ),
            )}
          </View>
          <View style={styles.filterGroup}>
            {STATUS_FILTERS.map((item) => (
              <FilterChip
                key={item.id}
                active={status === item.id}
                label={item.label}
                onPress={() => setStatus(item.id)}
              />
            ))}
          </View>
        </View>
      </AdminSection>

      <AdminSection title="入金与代收记录" meta={`${counts.total} RECORDS`}>
        {queue.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : queue.data?.length ? (
          <View style={styles.table}>
            {queue.data.map((row) => (
              <Pressable
                key={row.intentNo}
                accessibilityRole="link"
                onPress={() =>
                  router.push({
                    pathname: "/admin/broker-funding-detail",
                    params: {
                      sessionNo: row.sessionNo,
                      intentNo: row.intentNo,
                    },
                  } as never)
                }
                style={({ pressed }) => [
                  styles.row,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowPrimary}>
                  <Text style={[styles.intentNo, { color: colors.foreground }]}>
                    {row.intentNo}
                  </Text>
                  <Text style={[styles.sessionNo, { color: colors.muted }]}>
                    {row.sessionNo}
                  </Text>
                </View>
                <View style={styles.rowCell}>
                  <Text style={[styles.cellLabel, { color: colors.muted }]}>券商</Text>
                  <Text style={[styles.cellValue, { color: colors.foreground }]}>
                    {brokerLabel(row.brokerId)}
                  </Text>
                </View>
                <View style={styles.rowCell}>
                  <Text style={[styles.cellLabel, { color: colors.muted }]}>路线</Text>
                  <Text style={[styles.cellValue, { color: colors.foreground }]}>
                    {row.fundsRoute === "BROKER_DIRECT" ? "券商直充" : "平台代收"}
                  </Text>
                </View>
                <View style={styles.rowCell}>
                  <Text style={[styles.cellLabel, { color: colors.muted }]}>金额</Text>
                  <Text style={[styles.amount, { color: colors.primary }]}>
                    {row.expectedAmount} USDT
                  </Text>
                </View>
                <View style={styles.statusCell}>
                  <Text
                    style={[
                      styles.statusText,
                      { color: row.status === "EXCEPTION" ? "#F87171" : "#34D399" },
                    ]}
                  >
                    {STATUS_LABEL[row.status] ?? row.status}
                  </Text>
                  <Text style={[styles.arrow, { color: colors.muted }]}>›</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            emoji=""
            title="当前筛选没有入金记录"
            subtitle="切换路线或状态查看其他队列。EA商城订单请到独立的订单管理页面处理。"
          />
        )}
        {queue.error ? (
          <Text style={styles.errorText}>{queue.error.message}</Text>
        ) : null}
      </AdminSection>
    </AdminPageChrome>
  );
}

function CollectionApprovalControls() {
  const [brokerId, setBrokerId] = useState<BrokerId>("exness");
  const [approvalStatus, setApprovalStatus] =
    useState<ApprovalStatus>("PENDING");
  const [approvalReference, setApprovalReference] = useState("");
  const [approvedEntity, setApprovedEntity] = useState("");
  const [approvedRegion, setApprovedRegion] = useState("");
  const [approvedChannelId, setApprovedChannelId] = useState("");
  const [validUntil, setValidUntil] = useState(() =>
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  );
  const [allowedNetworks, setAllowedNetworks] = useState<
    BrokerFundingNetwork[]
  >(["TRON", "ETHEREUM", "BSC", "SOLANA"]);
  const [note, setNote] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const approvals = trpc.v2.managedSessions.adminCollectionApprovals.useQuery();
  const capabilities = trpc.v2.managedSessions.capabilities.useQuery();
  const setApproval =
    trpc.v2.managedSessions.adminSetCollectionApproval.useMutation();
  const current = approvals.data?.find(
    (item: { brokerId: string }) => item.brokerId === brokerId,
  );
  const operational = capabilities.data?.brokers.find(
    (broker) => broker.id === brokerId,
  )?.collectionOperational;
  const approving = approvalStatus === "APPROVED";
  const approvalFieldsValid =
    !approving ||
    (approvalReference.trim().length >= 6 &&
      approvedEntity.trim().length > 0 &&
      approvedRegion.trim().length > 0 &&
      approvedChannelId.trim().length > 0 &&
      allowedNetworks.length > 0 &&
      new Date(validUntil).getTime() > Date.now());
  const hasTotp = /^\d{6}$/.test(totpCode);

  const toggleNetwork = (network: BrokerFundingNetwork) => {
    setAllowedNetworks((currentNetworks) =>
      currentNetworks.includes(network)
        ? currentNetworks.filter((item) => item !== network)
        : [...currentNetworks, network],
    );
  };

  return (
    <AdminSection title="企业代收通道全局放行" meta="BEFORE ANY FUNDING INTENT">
      <View style={styles.approvalCard}>
        <Text style={styles.serviceText}>
          这里先于任何入金单管理三家券商通道。只有书面批准、获批实体/地区/通道、有效期、动态验证和企业钱包运营条件全部满足，客户才能选择平台代收。
        </Text>
        <View style={styles.approvalBrokerGrid}>
          {(["exness", "ic-markets", "blueberry-markets"] as const).map(
            (item) => {
              const row = approvals.data?.find(
                (approval: { brokerId: string }) => approval.brokerId === item,
              );
              const isOperational = capabilities.data?.brokers.find(
                (broker) => broker.id === item,
              )?.collectionOperational;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: brokerId === item }}
                  onPress={() => setBrokerId(item)}
                  style={[
                    styles.approvalBroker,
                    brokerId === item && styles.approvalBrokerActive,
                  ]}
                >
                  <Text style={styles.approvalBrokerName}>{brokerLabel(item)}</Text>
                  <Text style={styles.approvalBrokerState}>
                    {row?.status ?? "NOT_APPROVED"} · {isOperational ? "运营就绪" : "不可对客开放"}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>

        <Text style={styles.approvalCurrent}>
          当前后端记录：{current?.status ?? "NOT_APPROVED"} · 对客有效闸：
          {operational ? "OPEN" : "CLOSED"}
        </Text>
        <View style={styles.filterGroup}>
          {(["NOT_APPROVED", "PENDING", "APPROVED", "SUSPENDED"] as const).map(
            (item) => (
              <FilterChip
                key={item}
                active={approvalStatus === item}
                label={item}
                onPress={() => setApprovalStatus(item)}
              />
            ),
          )}
        </View>

        {approving ? (
          <>
            <ApprovalField label="书面批准参考号（仅存哈希）" value={approvalReference} onChange={setApprovalReference} />
            <View style={styles.approvalFieldsRow}>
              <ApprovalField label="获批签约实体" value={approvedEntity} onChange={setApprovedEntity} />
              <ApprovalField label="获批地区" value={approvedRegion} onChange={setApprovedRegion} />
              <ApprovalField label="获批通道 ID" value={approvedChannelId} onChange={setApprovedChannelId} />
            </View>
            <ApprovalField label="批准有效期（ISO 8601）" value={validUntil} onChange={setValidUntil} />
            <View style={styles.networkGrid}>
              {BROKER_FUNDING_NETWORKS.map((network) => {
                const active = allowedNetworks.includes(network);
                return (
                  <Pressable
                    key={network}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => toggleNetwork(network)}
                    style={[styles.networkChip, active && styles.networkChipActive]}
                  >
                    <Text style={[styles.networkText, active && styles.networkTextActive]}>
                      {network}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <ApprovalField label="审核备注（不得包含凭据）" value={note} onChange={setNote} />
        <ApprovalField
          label="6 位动态验证码"
          value={totpCode}
          onChange={(value) =>
            setTotpCode(value.replace(/\D/g, "").slice(0, 6))
          }
          secure
        />
        <Pressable
          accessibilityRole="button"
          disabled={setApproval.isPending || !hasTotp || !approvalFieldsValid}
          onPress={() =>
            setApproval.mutate(
              {
                brokerId,
                status: approvalStatus,
                approvalReference: approving
                  ? approvalReference.trim()
                  : undefined,
                approvedEntity: approving ? approvedEntity.trim() : undefined,
                approvedRegion: approving ? approvedRegion.trim() : undefined,
                approvedChannelId: approving
                  ? approvedChannelId.trim()
                  : undefined,
                validUntil: approving ? validUntil : null,
                allowedNetworks: approving ? allowedNetworks : undefined,
                note: note.trim() || undefined,
                totpCode,
              },
              {
                onSuccess: () => {
                  setTotpCode("");
                  void approvals.refetch();
                  void capabilities.refetch();
                },
              },
            )
          }
          style={[
            styles.approvalSubmit,
            (setApproval.isPending || !hasTotp || !approvalFieldsValid) &&
              styles.approvalSubmitDisabled,
          ]}
        >
          <Text style={styles.approvalSubmitText}>
            {setApproval.isPending ? "正在登记" : "动态验证并登记通道状态"}
          </Text>
        </Pressable>
        {setApproval.error ? (
          <Text style={styles.errorText}>{setApproval.error.message}</Text>
        ) : null}
      </View>
    </AdminSection>
  );
}

function ApprovalField({
  label,
  value,
  onChange,
  secure = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  secure?: boolean;
}) {
  return (
    <View style={styles.approvalField}>
      <Text style={styles.approvalLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={secure ? "number-pad" : "default"}
        maxLength={secure ? 6 : undefined}
        autoComplete={secure ? "one-time-code" : "off"}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor="#475569"
        style={styles.approvalInput}
      />
    </View>
  );
}

function ExternalLink({
  label,
  url,
  primary = false,
}: {
  label: string;
  url: string;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={[styles.serviceLink, primary && styles.serviceLinkPrimary]}
    >
      <Text style={[styles.serviceLinkText, primary && styles.serviceLinkTextPrimary]}>
        {label} ↗
      </Text>
    </Pressable>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function brokerLabel(id: string) {
  return id === "exness"
    ? "Exness"
    : id === "ic-markets"
      ? "IC Markets"
      : id === "blueberry-markets"
        ? "Blueberry Markets"
        : id;
}

const styles = StyleSheet.create({
  serviceCard: { padding: 14, borderWidth: 1, borderColor: "rgba(216,188,131,0.24)", borderRadius: 5, backgroundColor: "rgba(216,188,131,0.04)", gap: 9 },
  serviceTopline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  serviceEyebrow: { color: "#64748B", fontSize: 8, fontWeight: "900" },
  serviceTitle: { marginTop: 3, color: "#F8FAFC", fontSize: 17, fontWeight: "900" },
  manualPill: { paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(251,191,36,0.35)", borderRadius: 4 },
  manualPillText: { color: "#FBBF24", fontSize: 8, fontWeight: "900" },
  serviceText: { color: "#94A3B8", fontSize: 9, lineHeight: 15 },
  serviceLinks: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  serviceLink: { minHeight: 34, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 4, alignItems: "center", justifyContent: "center" },
  serviceLinkPrimary: { backgroundColor: "#D8BC83", borderColor: "#D8BC83" },
  serviceLinkText: { color: "#CBD5E1", fontSize: 9, fontWeight: "900" },
  serviceLinkTextPrimary: { color: "#050810" },
  approvalCard: { padding: 14, borderWidth: 1, borderColor: "rgba(96,165,250,0.22)", borderRadius: 5, backgroundColor: "rgba(59,130,246,0.04)", gap: 10 },
  approvalBrokerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  approvalBroker: { flex: 1, minWidth: 180, padding: 10, borderWidth: 1, borderColor: "rgba(148,163,184,0.18)", borderRadius: 4, gap: 4 },
  approvalBrokerActive: { borderColor: "rgba(216,188,131,0.72)", backgroundColor: "rgba(216,188,131,0.06)" },
  approvalBrokerName: { color: "#E2E8F0", fontSize: 11, fontWeight: "900" },
  approvalBrokerState: { color: "#94A3B8", fontSize: 8, fontWeight: "800" },
  approvalCurrent: { color: "#93C5FD", fontSize: 10, fontWeight: "800" },
  approvalFieldsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  approvalField: { flex: 1, minWidth: 180, gap: 5 },
  approvalLabel: { color: "#94A3B8", fontSize: 9, lineHeight: 14, fontWeight: "800" },
  approvalInput: { minHeight: 39, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 4, backgroundColor: "rgba(2,6,23,0.74)", color: "#F8FAFC", fontSize: 11 },
  networkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  networkChip: { minHeight: 30, paddingHorizontal: 9, borderWidth: 1, borderColor: "rgba(148,163,184,0.18)", borderRadius: 4, alignItems: "center", justifyContent: "center" },
  networkChipActive: { borderColor: "rgba(52,211,153,0.52)", backgroundColor: "rgba(16,185,129,0.08)" },
  networkText: { color: "#64748B", fontSize: 8, fontWeight: "900" },
  networkTextActive: { color: "#6EE7B7" },
  approvalSubmit: { minHeight: 42, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#D8BC83", paddingHorizontal: 12 },
  approvalSubmitDisabled: { opacity: 0.38 },
  approvalSubmitText: { color: "#17120A", fontSize: 10, fontWeight: "900" },
  filters: { gap: 8 },
  filterGroup: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterChip: { minHeight: 34, paddingHorizontal: 11, borderWidth: 1, borderColor: "rgba(148,163,184,0.18)", borderRadius: 4, alignItems: "center", justifyContent: "center" },
  filterChipActive: { borderColor: "rgba(216,188,131,0.72)", backgroundColor: "rgba(216,188,131,0.08)" },
  filterText: { color: "#94A3B8", fontSize: 10, fontWeight: "800" },
  filterTextActive: { color: "#D8BC83" },
  center: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  table: { gap: 7 },
  row: { padding: 12, borderWidth: 1, borderRadius: 5, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 16 },
  rowPrimary: { minWidth: 210, flex: 1, gap: 3 },
  intentNo: { fontSize: 12, fontWeight: "900" },
  sessionNo: { fontSize: 9 },
  rowCell: { minWidth: 110, gap: 3 },
  cellLabel: { fontSize: 8, fontWeight: "800" },
  cellValue: { fontSize: 10, fontWeight: "800" },
  amount: { fontSize: 11, fontWeight: "900" },
  statusCell: { minWidth: 135, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  statusText: { fontSize: 9, fontWeight: "900" },
  arrow: { fontSize: 18 },
  errorText: { color: "#F87171", fontSize: 11, marginTop: 10 },
  pressed: { opacity: 0.7 },
});
