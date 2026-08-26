import type { inferRouterOutputs } from "@trpc/server";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import type { AppRouter } from "@/server/routers";

type AdminSession = inferRouterOutputs<AppRouter>["v2"]["managedSessions"]["adminList"][number];
type AdminSlot = AdminSession["executionSlots"][number];

const STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "待审核",
  PENDING_AUTHORIZATION: "待核验券商连接与交易权",
  READY: "已就绪，待明确启用",
  ACTIVE: "已登记启用",
  EXIT_REQUESTED: "退出处理中",
  WINDING_DOWN: "平仓/交接中",
  ENDED: "已结束",
  CANCELLED: "已取消",
  REJECTED: "未通过",
};

export default function AllianceSessionsAdminPage() {
  const colors = useColors();
  const sessions = trpc.v2.managedSessions.adminList.useQuery();
  const submitted = useMemo(
    () => (sessions.data ?? []).filter((session) => session.status !== "DRAFT"),
    [sessions.data],
  );
  const counts = useMemo(
    () => ({
      total: submitted.length,
      review: submitted.filter((session) => session.status === "PENDING_REVIEW").length,
      authorization: submitted.filter(
        (session) => session.status === "PENDING_AUTHORIZATION",
      ).length,
      ready: submitted.filter((session) => session.status === "READY").length,
    }),
    [submitted],
  );

  return (
    <AdminPageChrome
      eyebrow="AI量化联盟 · MANDATE OPERATIONS"
      title="资管委托接入与启用"
      subtitle="先在这里审核委托、逐个核验客户本人券商账户与交易权，再进入入金指令。提现权始终为 NONE；本页不保存券商密码或 API Key。"
      metrics={[
        { label: "已提交委托", value: counts.total },
        { label: "待审核", value: counts.review, tone: "#FBBF24" },
        { label: "待权限核验", value: counts.authorization, tone: "#60A5FA" },
        { label: "待启用", value: counts.ready, tone: "#34D399" },
      ]}
    >
      <AdminSection title="委托队列" meta={`${counts.total} SUBMITTED`}>
        {sessions.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : sessions.error ? (
          <EmptyState
            emoji=""
            title="委托队列读取失败"
            subtitle={sessions.error.message}
            actionLabel="重试"
            onAction={() => void sessions.refetch()}
          />
        ) : submitted.length ? (
          <View style={styles.list}>
            {submitted.map((session) => (
              <SessionReviewCard
                key={session.sessionNo}
                session={session}
                onRefresh={() => void sessions.refetch()}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            emoji=""
            title="暂无已提交委托"
            subtitle="客户将六策略方案提交审核后，会在这里出现。"
          />
        )}
      </AdminSection>
    </AdminPageChrome>
  );
}

function SessionReviewCard({
  session,
  onRefresh,
}: {
  session: AdminSession;
  onRefresh: () => void;
}) {
  const colors = useColors();
  const [note, setNote] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [slotForms, setSlotForms] = useState<
    Record<string, { accountAlias: string; authorizationReference: string }>
  >({});
  const reviewSlot = trpc.v2.managedSessions.adminReviewSlot.useMutation();
  const transition = trpc.v2.managedSessions.adminTransition.useMutation();
  const busy = reviewSlot.isPending || transition.isPending;
  const error = reviewSlot.error?.message ?? transition.error?.message;
  const hasTotp = /^\d{6}$/.test(totpCode);
  const blockers = activationBlockers(session.readiness);

  const success = () => {
    setTotpCode("");
    onRefresh();
  };
  const slotForm = (slot: AdminSlot) =>
    slotForms[slot.slotKey] ?? {
      accountAlias: "",
      authorizationReference: "",
    };
  const updateSlot = (
    slot: AdminSlot,
    field: "accountAlias" | "authorizationReference",
    value: string,
  ) => {
    setSlotForms((current) => ({
      ...current,
      [slot.slotKey]: { ...slotForm(slot), [field]: value },
    }));
  };

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIdentity}>
          <Text style={[styles.sessionNo, { color: colors.foreground }]}>
            {session.sessionNo}
          </Text>
          <Text style={[styles.sessionMeta, { color: colors.muted }]}>
            {session.targetCapital} USDT · {session.executionSlots.length} 家可选券商 ·
            {session.fundsRoute === "BROKER_DIRECT" ? "直入本人券商" : "企业专属地址代收"}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>
            {STATUS_LABEL[session.status] ?? session.status}
          </Text>
        </View>
      </View>

      <View style={styles.boundaryBox}>
        <Text style={styles.boundaryTitle}>权限边界</Text>
        <Text style={styles.boundaryText}>
          交易权：{session.tradeAuthorizationStatus} · 提现权：NONE · 自动转币：关闭
        </Text>
      </View>

      {session.status === "PENDING_REVIEW" ? (
        <View style={styles.actionBlock}>
          <Field label="审核备注（不得包含任何凭据）" value={note} onChangeText={setNote} />
          <ActionButton
            label="审核通过，进入券商权限核验"
            disabled={busy}
            onPress={() =>
              transition.mutate(
                {
                  sessionNo: session.sessionNo,
                  toStatus: "PENDING_AUTHORIZATION",
                  note: note.trim() || undefined,
                },
                { onSuccess: onRefresh },
              )
            }
          />
        </View>
      ) : null}

      {["PENDING_AUTHORIZATION", "READY", "ACTIVE"].includes(session.status) ? (
        <View style={styles.slots}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
            券商连接与交易权核验
          </Text>
          {session.executionSlots.map((slot: AdminSlot) => {
            const form = slotForm(slot);
            const verified =
              slot.connectionStatus === "VERIFIED" &&
              slot.tradePermission === "GRANTED";
            return (
              <View key={slot.slotKey} style={styles.slotCard}>
                <View style={styles.slotTopline}>
                  <View>
                    <Text style={styles.slotTitle}>{brokerLabel(slot.brokerId)}</Text>
                    <Text style={styles.slotMeta}>
                      {slot.capitalWeightPct}% · {slot.slotKey}
                    </Text>
                  </View>
                  <Text style={verified ? styles.verified : styles.pending}>
                    {verified ? "已核验 / 无提现权" : "待核验"}
                  </Text>
                </View>
                {!verified && session.status === "PENDING_AUTHORIZATION" ? (
                  <>
                    <Field
                      label="脱敏账户别名"
                      value={form.accountAlias}
                      onChangeText={(value) => updateSlot(slot, "accountAlias", value)}
                    />
                    <Field
                      label="券商外部授权参考号（仅存哈希）"
                      value={form.authorizationReference}
                      onChangeText={(value) =>
                        updateSlot(slot, "authorizationReference", value)
                      }
                      mono
                    />
                    <ActionButton
                      label="动态验证并授予交易权"
                      disabled={
                        busy ||
                        !hasTotp ||
                        form.authorizationReference.trim().length < 6
                      }
                      onPress={() =>
                        reviewSlot.mutate(
                          {
                            sessionNo: session.sessionNo,
                            slotKey: slot.slotKey,
                            connectionStatus: "VERIFIED",
                            tradePermission: "GRANTED",
                            accountAlias: form.accountAlias.trim() || null,
                            authorizationReference:
                              form.authorizationReference.trim(),
                            totpCode,
                          },
                          { onSuccess: success },
                        )
                      }
                    />
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {session.status === "PENDING_AUTHORIZATION" ? (
        <View style={styles.actionBlock}>
          {session.readiness.unverifiedSlots.length ? (
            <Text style={styles.warningText}>
              未核验槽位：{session.readiness.unverifiedSlots.join("、")}
            </Text>
          ) : null}
          <ActionButton
            label="全部权限核验完成，标记已就绪"
            disabled={busy || session.readiness.unverifiedSlots.length > 0}
            onPress={() =>
              transition.mutate(
                {
                  sessionNo: session.sessionNo,
                  toStatus: "READY",
                  note: note.trim() || undefined,
                },
                { onSuccess: onRefresh },
              )
            }
          />
        </View>
      ) : null}

      {session.status === "READY" ? (
        <View style={styles.actionBlock}>
          {blockers.length ? (
            <Text style={styles.warningText}>
              当前不可启用：{blockers.join("；")}。DEMO、离线策略、未核验券商或未批准代收通道都会被服务端阻断。
            </Text>
          ) : null}
          <ActionButton
            label="动态验证并登记启用"
            disabled={busy || !hasTotp || !session.readiness.canActivate}
            onPress={() =>
              transition.mutate(
                {
                  sessionNo: session.sessionNo,
                  toStatus: "ACTIVE",
                  note: note.trim() || undefined,
                  totpCode,
                },
                { onSuccess: success },
              )
            }
          />
          <Text style={styles.helpText}>
            登记 ACTIVE 不代表已接通真实 broker API 或已自动下单；实际执行仍须按外部券商权限与运营流程确认。
          </Text>
        </View>
      ) : null}

      {["PENDING_AUTHORIZATION", "READY"].includes(session.status) ? (
        <View style={styles.securityBox}>
          <Text style={styles.securityTitle}>6 位动态验证码</Text>
          <TextInput
            value={totpCode}
            onChangeText={(value) => setTotpCode(value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            placeholderTextColor="#475569"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            style={styles.totpInput}
          />
          <Text style={styles.helpText}>
            每次敏感操作成功后立即清空；后续步骤请使用新的当前动态码。不保存、不回显 TOTP secret。
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  mono = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#475569"
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, mono && styles.mono]}
      />
    </View>
  );
}

function ActionButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function activationBlockers(readiness: AdminSession["readiness"]) {
  const blockers: string[] = [];
  if (readiness.providerActivationBlocked) blockers.push("当前数据提供器为 DEMO");
  if (readiness.unavailableStrategyIds.length) {
    blockers.push(`离线策略 ${readiness.unavailableStrategyIds.join("、")}`);
  }
  if (readiness.nonLiveStrategyIds.length) {
    blockers.push(`非 LIVE/HYBRID 策略 ${readiness.nonLiveStrategyIds.join("、")}`);
  }
  if (readiness.uncoveredStrategyIds.length) {
    blockers.push(`券商未覆盖策略 ${readiness.uncoveredStrategyIds.join("、")}`);
  }
  if (readiness.unverifiedSlots.length) {
    blockers.push(`未核验槽位 ${readiness.unverifiedSlots.join("、")}`);
  }
  if (readiness.collectionApprovalBlockedBrokers.length) {
    blockers.push(
      `代收通道未放行 ${readiness.collectionApprovalBlockedBrokers.join("、")}`,
    );
  }
  return blockers;
}

function brokerLabel(id: string) {
  if (id === "exness") return "Exness";
  if (id === "ic-markets") return "IC Markets";
  if (id === "blueberry-markets") return "Blueberry Markets";
  return id;
}

const styles = StyleSheet.create({
  center: { minHeight: 220, alignItems: "center", justifyContent: "center" },
  list: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 7, padding: 14, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardIdentity: { flex: 1, minWidth: 0, gap: 5 },
  sessionNo: { fontSize: 15, fontWeight: "900", fontFamily: "monospace" },
  sessionMeta: { fontSize: 11, lineHeight: 17, fontWeight: "700" },
  statusPill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 4, backgroundColor: "rgba(216,188,131,0.12)", borderWidth: 1, borderColor: "rgba(216,188,131,0.28)" },
  statusPillText: { color: "#E8D2A3", fontSize: 9, fontWeight: "900" },
  boundaryBox: { padding: 10, borderRadius: 5, borderWidth: 1, borderColor: "rgba(52,211,153,0.22)", backgroundColor: "rgba(16,185,129,0.07)", gap: 4 },
  boundaryTitle: { color: "#6EE7B7", fontSize: 10, fontWeight: "900" },
  boundaryText: { color: "#A7F3D0", fontSize: 11, lineHeight: 17, fontWeight: "700" },
  actionBlock: { gap: 9, padding: 11, borderRadius: 5, borderWidth: 1, borderColor: "rgba(148,163,184,0.15)", backgroundColor: "rgba(2,6,23,0.32)" },
  slots: { gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "900" },
  slotCard: { padding: 11, borderRadius: 5, borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", backgroundColor: "rgba(15,23,42,0.6)", gap: 8 },
  slotTopline: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  slotTitle: { color: "#E2E8F0", fontSize: 12, fontWeight: "900" },
  slotMeta: { color: "#64748B", fontSize: 9, marginTop: 3, fontWeight: "800" },
  verified: { color: "#6EE7B7", fontSize: 9, fontWeight: "900" },
  pending: { color: "#FBBF24", fontSize: 9, fontWeight: "900" },
  field: { gap: 5 },
  fieldLabel: { color: "#94A3B8", fontSize: 10, lineHeight: 15, fontWeight: "800" },
  input: { minHeight: 40, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 4, backgroundColor: "rgba(2,6,23,0.72)", color: "#F8FAFC", paddingHorizontal: 10, fontSize: 12 },
  mono: { fontFamily: "monospace" },
  actionButton: { minHeight: 42, borderRadius: 4, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, backgroundColor: "#D8BC83" },
  actionButtonText: { color: "#17120A", fontSize: 11, fontWeight: "900", textAlign: "center" },
  actionDisabled: { opacity: 0.38 },
  pressed: { opacity: 0.78 },
  securityBox: { gap: 7, padding: 11, borderRadius: 5, borderWidth: 1, borderColor: "rgba(96,165,250,0.22)", backgroundColor: "rgba(59,130,246,0.06)" },
  securityTitle: { color: "#93C5FD", fontSize: 10, fontWeight: "900" },
  totpInput: { width: 132, minHeight: 42, borderWidth: 1, borderColor: "rgba(96,165,250,0.34)", borderRadius: 4, backgroundColor: "rgba(2,6,23,0.84)", color: "#F8FAFC", paddingHorizontal: 12, fontSize: 17, fontFamily: "monospace", letterSpacing: 5 },
  warningText: { color: "#FBBF24", fontSize: 11, lineHeight: 17, fontWeight: "700" },
  helpText: { color: "#94A3B8", fontSize: 10, lineHeight: 16 },
  errorText: { color: "#FCA5A5", fontSize: 11, lineHeight: 17, fontWeight: "700" },
});
