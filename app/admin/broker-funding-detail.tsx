import { useLocalSearchParams, useRouter } from "expo-router";
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
import {
  BROKER_FUNDING_NETWORKS,
  type BrokerFundingNetwork,
} from "@/shared/managed-sessions/contracts";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草案",
  WAITING_ACCOUNT: "待账户核验",
  WAITING_INSTRUCTIONS: "待配置当次入金指令",
  READY_TO_FUND: "待客户转账",
  TX_SUBMITTED: "客户已提交 txHash",
  RECEIVED: "平台专属地址已收款",
  RECONCILED: "收款已对账",
  AWAITING_PAYOUT: "待动态验证并从外部钱包转出",
  PAYOUT_SUBMITTED: "已登记转出 txHash",
  BROKER_CREDIT_PENDING: "等待券商到账",
  CREDITED: "券商已到账",
  EXCEPTION: "异常/退款处理中",
  CANCELLED: "已取消/已退款",
};

const RECONCILIATION_RESULTS = [
  "MATCHED",
  "UNDERPAID",
  "OVERPAID",
  "WRONG_NETWORK",
  "LATE_RECEIPT",
  "DUPLICATE_TX",
  "REFUND_PENDING",
  "MANUAL_REVIEW",
] as const;

const SESSION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "草案",
  PENDING_REVIEW: "待管理员审核",
  PENDING_AUTHORIZATION: "待券商连接与交易权核验",
  READY: "已就绪，待明确启用",
  ACTIVE: "已启用",
  EXIT_REQUESTED: "退出处理中",
  WINDING_DOWN: "平仓/交接中",
  ENDED: "已结束",
  CANCELLED: "已取消",
  REJECTED: "未通过",
};

export default function BrokerFundingDetailPage() {
  const colors = useColors();
  const router = useRouter();
  const { sessionNo = "", intentNo = "" } = useLocalSearchParams<{
    sessionNo?: string;
    intentNo?: string;
  }>();
  const [network, setNetwork] = useState<BrokerFundingNetwork>("TRON");
  const [depositAddress, setDepositAddress] = useState("");
  const [depositTag, setDepositTag] = useState("");
  const [brokerPortalInstructionRef, setBrokerPortalInstructionRef] =
    useState("");
  const [directInstructionsExpireAt, setDirectInstructionsExpireAt] =
    useState(defaultDirectInstructionExpiry);
  const [collectionLabel, setCollectionLabel] = useState("");
  const [collectionAddress, setCollectionAddress] = useState("");
  const [customerEligibilityReference, setCustomerEligibilityReference] =
    useState("");
  const [scopeAttested, setScopeAttested] = useState(false);
  const [collectionInstructionsExpireAt, setCollectionInstructionsExpireAt] =
    useState(defaultDirectInstructionExpiry);
  const [receivedAmount, setReceivedAmount] = useState("");
  const [confirmations, setConfirmations] = useState("1");
  const [screeningStatus, setScreeningStatus] = useState<
    "PENDING" | "CLEARED" | "HELD" | "REJECTED"
  >("PENDING");
  const [reconciliationResult, setReconciliationResult] =
    useState<(typeof RECONCILIATION_RESULTS)[number]>("MATCHED");
  const [note, setNote] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDestination, setPayoutDestination] = useState("");
  const [payoutTxHash, setPayoutTxHash] = useState("");
  const [creditedAmount, setCreditedAmount] = useState("");
  const [brokerReference, setBrokerReference] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [refundAddress, setRefundAddress] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundTxHash, setRefundTxHash] = useState("");
  const [approvalReference, setApprovalReference] = useState("");
  const [approvedEntity, setApprovedEntity] = useState("");
  const [approvedRegion, setApprovedRegion] = useState("");
  const [approvedChannelId, setApprovedChannelId] = useState("");
  const [approvalValidUntil, setApprovalValidUntil] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [slotAccountAlias, setSlotAccountAlias] = useState("");
  const [authorizationReference, setAuthorizationReference] = useState("");
  const [sessionReviewNote, setSessionReviewNote] = useState("");
  const [payoutDestinationReference, setPayoutDestinationReference] =
    useState("");

  const queue = trpc.v2.managedSessions.adminFundingQueue.useQuery({ limit: 200 });
  const sessions = trpc.v2.managedSessions.adminList.useQuery();
  const addresses = trpc.v2.managedSessions.adminCollectionAddresses.useQuery({
    status: "AVAILABLE",
  });
  const approvals =
    trpc.v2.managedSessions.adminCollectionApprovals.useQuery();
  const row = queue.data?.find((item) => item.intentNo === intentNo);
  const session = sessions.data?.find(
    (item: { sessionNo: string }) => item.sessionNo === sessionNo,
  );
  const sessionSlot = session?.executionSlots.find(
    (slot: { slotKey: string }) => slot.slotKey === row?.slotKey,
  );
  const approval = approvals.data?.find(
    (item: { brokerId: string; status: string }) =>
      item.brokerId === row?.brokerId,
  );

  const setDirect =
    trpc.v2.managedSessions.adminSetDirectFundingInstructions.useMutation();
  const createAddress =
    trpc.v2.managedSessions.adminCreateCollectionAddress.useMutation();
  const assignAddress =
    trpc.v2.managedSessions.adminAssignCollectionAddress.useMutation();
  const recordReceipt =
    trpc.v2.managedSessions.adminRecordFundingReceipt.useMutation();
  const screenFunding =
    trpc.v2.managedSessions.adminScreenFunding.useMutation();
  const reconcile =
    trpc.v2.managedSessions.adminReconcileFunding.useMutation();
  const requestPayout =
    trpc.v2.managedSessions.adminRequestPayout.useMutation();
  const approvePayout =
    trpc.v2.managedSessions.adminApprovePayout.useMutation();
  const recordPayout =
    trpc.v2.managedSessions.adminRecordPayout.useMutation();
  const markCreditPending =
    trpc.v2.managedSessions.adminMarkBrokerCreditPending.useMutation();
  const markCredited =
    trpc.v2.managedSessions.adminMarkFundingCredited.useMutation();
  const markException =
    trpc.v2.managedSessions.adminMarkFundingException.useMutation();
  const resolveException =
    trpc.v2.managedSessions.adminResolveFundingException.useMutation();
  const verifyRefund =
    trpc.v2.managedSessions.adminVerifyRefundAddress.useMutation();
  const recordRefund =
    trpc.v2.managedSessions.adminRecordRefund.useMutation();
  const setApproval =
    trpc.v2.managedSessions.adminSetCollectionApproval.useMutation();
  const reviewSlot = trpc.v2.managedSessions.adminReviewSlot.useMutation();
  const transitionSession =
    trpc.v2.managedSessions.adminTransition.useMutation();

  const mutations = [
    setDirect,
    createAddress,
    assignAddress,
    recordReceipt,
    screenFunding,
    reconcile,
    requestPayout,
    approvePayout,
    recordPayout,
    markCreditPending,
    markCredited,
    markException,
    resolveException,
    verifyRefund,
    recordRefund,
    setApproval,
    reviewSlot,
    transitionSession,
  ];
  const busy = mutations.some((mutation) => mutation.isPending);
  const mutationError = mutations.find((mutation) => mutation.error)?.error
    ?.message;
  const refresh = () => {
    void queue.refetch();
    void addresses.refetch();
    void approvals.refetch();
    void sessions.refetch();
  };
  const sensitiveSuccess = () => {
    setTotpCode("");
    refresh();
  };
  const hasTotp = /^\d{6}$/.test(totpCode);
  const ref = { sessionNo, intentNo };
  const amount = (value: string, fallback?: string | null) =>
    normalizeAmount(value || fallback || "");

  const metrics = useMemo(
    () =>
      row
        ? [
            { label: "状态", value: STATUS_LABEL[row.status] ?? row.status },
            { label: "路线", value: row.fundsRoute === "BROKER_DIRECT" ? "券商直充" : "平台代收" },
            { label: "预计金额", value: `${row.expectedAmount} U` },
            { label: "券商", value: brokerLabel(row.brokerId) },
          ]
        : [],
    [row],
  );

  if (queue.isLoading) {
    return (
      <AdminPageChrome eyebrow="FUNDING DETAIL" title="券商入金详情">
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </AdminPageChrome>
    );
  }
  if (!row) {
    return (
      <AdminPageChrome eyebrow="FUNDING DETAIL" title="券商入金详情">
        <EmptyState
          emoji=""
          title="没有找到该入金记录"
          subtitle="请从券商入金与代收队列重新进入。"
          actionLabel="返回入金队列"
          onAction={() => router.replace("/admin/broker-funding" as never)}
        />
      </AdminPageChrome>
    );
  }

  return (
    <AdminPageChrome
      eyebrow="AI量化联盟 · FUNDING DETAIL"
      title={row.intentNo}
      subtitle={`${row.sessionNo} · ${STATUS_LABEL[row.status] ?? row.status}`}
      metrics={metrics}
      maxWidth={1180}
      action={
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>返回队列</Text>
        </Pressable>
      }
    >
      <AdminSection title="单据与资金边界" meta="READ-ONLY PROJECTION">
        <View style={styles.infoGrid}>
          <Info label="券商" value={brokerLabel(row.brokerId)} />
          <Info label="网络" value={row.network ?? "待配置"} />
          <Info label="专属地址/券商地址" value={row.depositAddress ?? "待配置"} mono />
          <Info label="标签/Memo" value={row.depositTag ?? "无或待配置"} mono />
          <Info label="客户 txHash" value={row.txHash ?? "未提交"} mono />
          <Info label="申报金额" value={row.declaredAmount ? `${row.declaredAmount} U` : "未申报"} />
          <Info label="平台实收" value={row.receivedAmount ? `${row.receivedAmount} U` : "不适用/未记录"} />
          <Info label="转出 txHash" value={row.payoutTxHash ?? "未转出"} mono />
          <Info label="券商到账" value={row.creditedAmount ? `${row.creditedAmount} U` : "未确认"} />
          <Info label="自动转币" value="否（MANUAL）" />
        </View>
        <View style={styles.safetyNotice}>
          <Text style={styles.safetyTitle}>三账隔离 / 私钥不进平台</Text>
          <Text style={styles.safetyText}>
            本页只处理该资管入金单。EA商城销售款与客户直充券商均使用独立账簿；
            页面不会保存私钥、助记词、OTP、券商密码，也不会触发自动链上转币。
          </Text>
        </View>
      </AdminSection>

      <AdminSection title="敏感操作动态验证" meta="6-DIGIT TOTP">
        <View style={styles.actionCard}>
          <Text style={styles.actionHelp}>
            代收许可、地址分配、筛查/对账、转出与退款每一步都要重新输入 6 位动态验证码。
            验证码只用于本次请求，成功后立即清空；本站不保存或回显密钥。
          </Text>
          <TextInput
            accessibilityLabel="六位动态验证码"
            value={totpCode}
            onChangeText={(value) => setTotpCode(value.replace(/\D/g, "").slice(0, 6))}
            placeholder="输入当前 6 位动态验证码"
            placeholderTextColor="#64748B"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            style={[styles.input, styles.totpInput]}
          />
          <Text style={styles.actionHelp}>
            实际转币须在 BVNK、Cobo 或经批准的外部企业钱包完成；本站只登记申请、复核结果与 txHash，不自动签名或转币。
          </Text>
        </View>
      </AdminSection>

      <AdminSection title="接入与启用" meta="BROKER AUTHORIZATION / ACTIVATION">
        {session && sessionSlot ? (
          <View style={styles.actionCard}>
            <View style={styles.infoGrid}>
              <Info
                label="委托状态"
                value={SESSION_STATUS_LABEL[session.status] ?? session.status}
              />
              <Info
                label="当前券商槽"
                value={`${brokerLabel(sessionSlot.brokerId)} · ${sessionSlot.slotKey}`}
              />
              <Info
                label="连接核验"
                value={sessionSlot.connectionStatus}
              />
              <Info
                label="交易权限"
                value={`${sessionSlot.tradePermission} · 提款权 ${sessionSlot.withdrawalPermission}`}
              />
            </View>
            <Text style={styles.actionHelp}>
              只登记脱敏账户别名与券商外部授权参考号；不得输入券商密码、API Key、短信码、私钥或令牌。
              连接核验会把本槽入金单从“待账户核验”推进到“待配置当次入金指令”。
            </Text>

            {session.status === "PENDING_REVIEW" ? (
              <>
                <Field
                  label="委托审核备注（不含任何凭据）"
                  value={sessionReviewNote}
                  onChange={setSessionReviewNote}
                  multiline
                />
                <ActionButton
                  label="审核通过，进入券商授权阶段"
                  primary
                  disabled={busy}
                  onPress={() =>
                    transitionSession.mutate(
                      {
                        sessionNo,
                        toStatus: "PENDING_AUTHORIZATION",
                        note: sessionReviewNote || undefined,
                      },
                      { onSuccess: refresh },
                    )
                  }
                />
              </>
            ) : null}

            {[
              "PENDING_AUTHORIZATION",
              "READY",
              "ACTIVE",
            ].includes(session.status) ? (
              <>
                <Field
                  label="脱敏券商账户别名"
                  value={slotAccountAlias}
                  onChange={setSlotAccountAlias}
                />
                <Field
                  label="券商外部授权参考号（仅存哈希）"
                  value={authorizationReference}
                  onChange={setAuthorizationReference}
                  mono
                />
                <ActionButton
                  label="动态验证连接并授予交易权（无提款权）"
                  primary
                  disabled={
                    busy ||
                    !hasTotp ||
                    authorizationReference.trim().length < 6
                  }
                  onPress={() =>
                    reviewSlot.mutate(
                      {
                        sessionNo,
                        slotKey: sessionSlot.slotKey,
                        connectionStatus: "VERIFIED",
                        tradePermission: "GRANTED",
                        accountAlias: slotAccountAlias || null,
                        authorizationReference,
                        totpCode,
                      },
                      { onSuccess: sensitiveSuccess },
                    )
                  }
                />
              </>
            ) : null}

            {session.status === "PENDING_AUTHORIZATION" ? (
              <>
                {session.readiness.unverifiedSlots.length ? (
                  <Text style={styles.blockedText}>
                    仍有未核验券商槽：{session.readiness.unverifiedSlots.join("、")}。请从各自入金单逐一完成连接与交易权核验。
                  </Text>
                ) : null}
                <ActionButton
                  label="全部交易权核验完成，标记 READY"
                  disabled={busy || session.readiness.unverifiedSlots.length > 0}
                  onPress={() =>
                    transitionSession.mutate(
                      {
                        sessionNo,
                        toStatus: "READY",
                        note: sessionReviewNote || undefined,
                      },
                      { onSuccess: refresh },
                    )
                  }
                />
              </>
            ) : null}

            {session.status === "READY" ? (
              <>
                {!session.readiness.canActivate ? (
                  <Text style={styles.blockedText}>
                    当前不可启用：
                    {activationBlockers(session.readiness).join("；") || "尚未满足服务端就绪条件"}。
                    页面不会把 DEMO、离线策略或未核验连接伪装成真实自动交易。
                  </Text>
                ) : null}
                <ActionButton
                  label="动态验证并明确启用真实委托"
                  primary
                  disabled={busy || !hasTotp || !session.readiness.canActivate}
                  onPress={() =>
                    transitionSession.mutate(
                      {
                        sessionNo,
                        toStatus: "ACTIVE",
                        note: sessionReviewNote || undefined,
                        totpCode,
                      },
                      { onSuccess: sensitiveSuccess },
                    )
                  }
                />
              </>
            ) : null}
          </View>
        ) : (
          <Text style={styles.actionHelp}>
            正在读取委托与券商授权状态；若持续不可用，请返回队列重试。
          </Text>
        )}
      </AdminSection>

      {row.fundsRoute === "PLATFORM_COLLECTION" ? (
        <AdminSection title="券商代收合规闸" meta="WRITTEN APPROVAL REQUIRED">
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>
              当前：{approval?.status ?? "NOT_APPROVED"}
            </Text>
            <Text style={styles.actionHelp}>
              未获书面放行不得分配企业代收地址；暂停状态不得继续转出。批准参考号只做哈希留档。
            </Text>
            <Field
              label="书面批准参考号（批准时必填）"
              value={approvalReference}
              onChange={setApprovalReference}
            />
            <Field
              label="获批签约主体（批准时必填）"
              value={approvedEntity}
              onChange={setApprovedEntity}
            />
            <Field
              label="获批地区（批准时必填）"
              value={approvedRegion}
              onChange={setApprovedRegion}
            />
            <Field
              label="获批通道 ID（批准时必填）"
              value={approvedChannelId}
              onChange={setApprovedChannelId}
              mono
            />
            <Field
              label="批准有效期（ISO 时间，例如 2027-08-24T00:00:00Z）"
              value={approvalValidUntil}
              onChange={setApprovalValidUntil}
              mono
            />
            <View style={styles.buttonRow}>
              {(["PENDING", "APPROVED", "SUSPENDED", "NOT_APPROVED"] as const).map(
                (status) => (
                  <ActionButton
                    key={status}
                    label={status}
                    disabled={
                      busy ||
                      !hasTotp ||
                      (status === "APPROVED" &&
                        (!approvalReference.trim() ||
                          !approvedEntity.trim() ||
                          !approvedRegion.trim() ||
                          !approvedChannelId.trim() ||
                          !isFutureDate(approvalValidUntil)))
                    }
                    onPress={() =>
                      setApproval.mutate(
                        {
                          brokerId: row.brokerId,
                          status,
                          approvalReference:
                            status === "APPROVED" ? approvalReference : undefined,
                          approvedEntity:
                            status === "APPROVED" ? approvedEntity : undefined,
                          approvedRegion:
                            status === "APPROVED" ? approvedRegion : undefined,
                          approvedChannelId:
                            status === "APPROVED" ? approvedChannelId : undefined,
                          validUntil:
                            status === "APPROVED"
                              ? new Date(approvalValidUntil)
                              : undefined,
                          allowedNetworks: [network],
                          totpCode,
                        },
                        { onSuccess: sensitiveSuccess },
                      )
                    }
                  />
                ),
              )}
            </View>
          </View>
        </AdminSection>
      ) : null}

      {row.status === "WAITING_INSTRUCTIONS" && row.fundsRoute === "BROKER_DIRECT" ? (
        <AdminSection title="登记券商客户门户当次指令" meta="BROKER DIRECT">
          <View style={styles.actionCard}>
            <NetworkPicker value={network} onChange={setNetwork} />
            <Field label="当次券商入金地址" value={depositAddress} onChange={setDepositAddress} mono />
            <Field label="标签/Memo（如有）" value={depositTag} onChange={setDepositTag} mono />
            <Field
              label="券商客户门户指令参考号/截图哈希"
              value={brokerPortalInstructionRef}
              onChange={setBrokerPortalInstructionRef}
              mono
            />
            <Field
              label="当次指令失效时间（ISO 8601，5 分钟后至 24 小时内）"
              value={directInstructionsExpireAt}
              onChange={setDirectInstructionsExpireAt}
              mono
            />
            <Text style={styles.actionHelp}>
              动态入金地址过期后必须回到客户本人券商门户重新获取，不得复用旧地址或标签。
            </Text>
            <ActionButton
              label="保存当次券商入金指令"
              primary
              disabled={
                busy ||
                !hasTotp ||
                !depositAddress.trim() ||
                brokerPortalInstructionRef.trim().length < 6 ||
                !isValidDirectInstructionExpiry(directInstructionsExpireAt)
              }
              onPress={() =>
                setDirect.mutate(
                  {
                    ...ref,
                    network,
                    depositAddress,
                    depositTag: depositTag || null,
                    instructionsExpireAt: directInstructionsExpireAt,
                    brokerPortalInstructionRef,
                    totpCode,
                  },
                  { onSuccess: sensitiveSuccess },
                )
              }
            />
          </View>
        </AdminSection>
      ) : null}

      {row.status === "WAITING_INSTRUCTIONS" && row.fundsRoute === "PLATFORM_COLLECTION" ? (
        <AdminSection title="分配单笔专属企业地址" meta="NO GLOBAL SHARED ADDRESS">
          <View style={styles.actionCard}>
            <Text style={styles.actionHelp}>
              地址池只保存公开地址与标签，不保存私钥。每个地址一次只分配给一笔代收单。
            </Text>
            <NetworkPicker value={network} onChange={setNetwork} />
            <Field label="地址池标签" value={collectionLabel} onChange={setCollectionLabel} />
            <Field label="公开收款地址" value={collectionAddress} onChange={setCollectionAddress} mono />
            <ActionButton
              label="新增可用企业地址"
              disabled={
                busy ||
                !hasTotp ||
                !collectionLabel.trim() ||
                !collectionAddress.trim()
              }
              onPress={() =>
                createAddress.mutate(
                  {
                    label: collectionLabel,
                    network,
                    address: collectionAddress,
                    totpCode,
                  },
                  { onSuccess: sensitiveSuccess },
                )
              }
            />
            <Field
              label="外部 KYC / 券商许可范围核对参考号（仅存哈希）"
              value={customerEligibilityReference}
              onChange={setCustomerEligibilityReference}
              mono
            />
            <Field
              label="专属代收指令失效时间（ISO 8601，5 分钟后至 24 小时内）"
              value={collectionInstructionsExpireAt}
              onChange={setCollectionInstructionsExpireAt}
              mono
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: scopeAttested }}
              onPress={() => setScopeAttested((current) => !current)}
              style={styles.attestationRow}
            >
              <Text style={styles.attestationMark}>{scopeAttested ? "☑" : "☐"}</Text>
              <Text style={styles.attestationText}>
                已人工核对该客户属于书面批准的签约实体、地区与通道范围。本系统不自动判定辖区资格。
              </Text>
            </Pressable>
            <View style={styles.addressList}>
              {addresses.data?.map(
                (address: {
                  id: number;
                  label: string;
                  network: string;
                  address: string;
                }) => (
                <View key={address.id} style={styles.addressRow}>
                  <View style={styles.addressCopy}>
                    <Text style={styles.addressTitle}>{address.label} · {address.network}</Text>
                    <Text style={styles.addressValue} numberOfLines={1}>{address.address}</Text>
                  </View>
                  <ActionButton
                    label="分配给本单"
                    primary
                    disabled={
                      busy ||
                      !hasTotp ||
                      !scopeAttested ||
                      customerEligibilityReference.trim().length < 6 ||
                      !isValidDirectInstructionExpiry(
                        collectionInstructionsExpireAt,
                      )
                    }
                    onPress={() =>
                      assignAddress.mutate(
                        {
                          ...ref,
                          addressId: address.id,
                          instructionsExpireAt: collectionInstructionsExpireAt,
                          customerEligibilityReference,
                          scopeAttested: true,
                          totpCode,
                        },
                        { onSuccess: sensitiveSuccess },
                      )
                    }
                  />
                </View>
                ),
              )}
            </View>
          </View>
        </AdminSection>
      ) : null}

      {row.status === "TX_SUBMITTED" && row.fundsRoute === "PLATFORM_COLLECTION" ? (
        <AdminSection title="记录平台专属地址实收" meta="ON-CHAIN RECEIPT">
          <View style={styles.actionCard}>
            <NetworkPicker value={network} onChange={setNetwork} />
            <Field label="实际收到 USDT" value={receivedAmount} onChange={setReceivedAmount} />
            <Field label="链上确认数" value={confirmations} onChange={setConfirmations} />
            <ActionButton
              label="记录平台收款"
              primary
              disabled={
                busy ||
                !normalizeAmount(receivedAmount) ||
                !Number.isInteger(Number(confirmations)) ||
                Number(confirmations) < 1
              }
              onPress={() =>
                recordReceipt.mutate(
                  {
                    ...ref,
                    receivedAmount: amount(receivedAmount, row.declaredAmount),
                    confirmations: Math.max(1, Number(confirmations) || 1),
                    observedNetwork: network,
                  },
                  { onSuccess: refresh },
                )
              }
            />
          </View>
        </AdminSection>
      ) : null}

      {row.status === "RECEIVED" ? (
        <AdminSection title="钱包筛查与代收对账" meta="COMPLIANCE / RECONCILIATION">
          <View style={styles.actionCard}>
            <ChoiceRow
              values={["PENDING", "CLEARED", "HELD", "REJECTED"] as const}
              value={screeningStatus}
              onChange={setScreeningStatus}
            />
            <Field label="合规/对账备注" value={note} onChange={setNote} multiline />
            <ActionButton
              label="保存钱包筛查状态"
              disabled={busy || !hasTotp}
              onPress={() =>
                screenFunding.mutate(
                  { ...ref, screeningStatus, complianceNote: note || undefined, totpCode },
                  { onSuccess: sensitiveSuccess },
                )
              }
            />
            <ChoiceRow
              values={RECONCILIATION_RESULTS}
              value={reconciliationResult}
              onChange={setReconciliationResult}
            />
            <ActionButton
              label={reconciliationResult === "MATCHED" ? "确认匹配并完成对账" : "按异常结果建单"}
              primary
              disabled={busy || !hasTotp}
              onPress={() =>
                reconcile.mutate(
                  { ...ref, result: reconciliationResult, note: note || undefined, totpCode },
                  { onSuccess: sensitiveSuccess },
                )
              }
            />
          </View>
        </AdminSection>
      ) : null}

      {row.status === "RECONCILED" ? (
        <AdminSection title="申请转入客户本人券商账户" meta="PAYOUT REQUEST">
          <View style={styles.actionCard}>
            <NetworkPicker value={network} onChange={setNetwork} />
            <Field label="转出金额 USDT" value={payoutAmount} onChange={setPayoutAmount} />
            <Field label="客户本人券商入金地址" value={payoutDestination} onChange={setPayoutDestination} mono />
            <Field
              label="券商门户目标地址参考号/截图哈希"
              value={payoutDestinationReference}
              onChange={setPayoutDestinationReference}
              mono
            />
            <Field label="申请备注" value={note} onChange={setNote} multiline />
            {row.complianceStatus !== "CLEARED" ? (
              <Text style={styles.blockedText}>
                钱包合规筛查尚未 CLEARED，当前禁止申请转出。
              </Text>
            ) : null}
            <ActionButton
              label="动态验证并提交转出申请"
              primary
              disabled={
                busy ||
                !hasTotp ||
                row.complianceStatus !== "CLEARED" ||
                !payoutDestination.trim() ||
                payoutDestinationReference.trim().length < 6
              }
              onPress={() =>
                requestPayout.mutate(
                  {
                    ...ref,
                    payoutAmount: amount(payoutAmount, row.receivedAmount),
                    payoutNetwork: network,
                    payoutDestination,
                    payoutDestinationReference,
                    note: note || undefined,
                    totpCode,
                  },
                  { onSuccess: sensitiveSuccess },
                )
              }
            />
          </View>
        </AdminSection>
      ) : null}

      {row.status === "AWAITING_PAYOUT" ? (
        <AdminSection title="外部企业钱包转出与登记" meta="TOTP / EXTERNAL WALLET">
          <View style={styles.actionCard}>
            <Text style={styles.actionHelp}>
              先用当前动态验证码复核申请，再到 BVNK、Cobo 或经批准的外部企业钱包完成转账；
              返回本站时须使用新的动态验证码登记 txHash。本站不会自动转币。
            </Text>
            {!row.payoutApproved ? (
              <ActionButton
                label="动态验证并确认转出申请"
                primary
                disabled={busy || !hasTotp}
                onPress={() =>
                  approvePayout.mutate(
                    { ...ref, note: note || undefined, totpCode },
                    { onSuccess: sensitiveSuccess },
                  )
                }
              />
            ) : (
              <>
                <Field label="实际转出 txHash" value={payoutTxHash} onChange={setPayoutTxHash} mono />
                <ActionButton
                  label="再次验证并登记外部钱包 txHash"
                  primary
                  disabled={busy || !hasTotp || payoutTxHash.trim().length < 16}
                  onPress={() =>
                    recordPayout.mutate(
                      { ...ref, payoutTxHash, totpCode },
                      { onSuccess: sensitiveSuccess },
                    )
                  }
                />
              </>
            )}
          </View>
        </AdminSection>
      ) : null}

      {(row.status === "TX_SUBMITTED" && row.fundsRoute === "BROKER_DIRECT") ||
      row.status === "PAYOUT_SUBMITTED" ? (
        <AdminSection title="等待券商入账" meta="BROKER CREDIT PENDING">
          <ActionButton
            label="标记为券商入账确认中"
            primary
            disabled={busy}
            onPress={() =>
              markCreditPending.mutate(
                { ...ref, confirmations: Math.max(1, Number(confirmations) || 1) },
                { onSuccess: refresh },
              )
            }
          />
        </AdminSection>
      ) : null}

      {row.status === "BROKER_CREDIT_PENDING" ? (
        <AdminSection title="确认客户本人券商账户到账" meta="FINAL CREDIT">
          <View style={styles.actionCard}>
            <Field label="券商实际到账 USDT" value={creditedAmount} onChange={setCreditedAmount} />
            <Field label="券商到账参考号（将哈希留档）" value={brokerReference} onChange={setBrokerReference} />
            <ActionButton
              label="确认券商已到账"
              primary
                  disabled={
                    busy ||
                    !hasTotp ||
                    !normalizeAmount(creditedAmount) ||
                    brokerReference.trim().length < 6
                  }
              onPress={() =>
                markCredited.mutate(
                  {
                    ...ref,
                    creditedAmount: amount(creditedAmount, row.expectedAmount),
                    brokerCreditReference: brokerReference,
                    totpCode,
                  },
                  { onSuccess: sensitiveSuccess },
                )
              }
            />
          </View>
        </AdminSection>
      ) : null}

      {row.status === "EXCEPTION" ? (
        <AdminSection title="异常处理与退款" meta="MANUAL REVIEW">
          <View style={styles.actionCard}>
            <Text style={styles.actionHelp}>异常原因：{row.exceptionReason ?? "未记录"}</Text>
            {row.fundsRoute === "PLATFORM_COLLECTION" ? (
              <>
                <Field label="退款地址（必须为已声明的原付款钱包）" value={refundAddress} onChange={setRefundAddress} mono />
                <ActionButton
                  label="核验原付款钱包地址"
                  disabled={busy || !hasTotp || !refundAddress.trim()}
                  onPress={() =>
                    verifyRefund.mutate(
                      { ...ref, address: refundAddress, note: note || undefined, totpCode },
                      { onSuccess: sensitiveSuccess },
                    )
                  }
                />
                <Field label="实际退款 USDT（不得超过平台实收）" value={refundAmount} onChange={setRefundAmount} />
                <Field label="外部企业钱包退款 txHash" value={refundTxHash} onChange={setRefundTxHash} mono />
                {!row.verifiedRefundAddress ? (
                  <Text style={styles.blockedText}>
                    退款地址尚未核验，不能登记退款转出。
                  </Text>
                ) : null}
                <ActionButton
                  label="登记退款金额与 txHash 并关闭"
                  disabled={
                    busy ||
                    !hasTotp ||
                    !row.verifiedRefundAddress ||
                    !normalizeAmount(refundAmount) ||
                    refundTxHash.trim().length < 16
                  }
                  onPress={() =>
                    recordRefund.mutate(
                      {
                        ...ref,
                        refundAmount: amount(refundAmount),
                        refundTxHash,
                        totpCode,
                      },
                      { onSuccess: sensitiveSuccess },
                    )
                  }
                />
              </>
            ) : null}
            <Field label="异常解决备注" value={resolutionNote} onChange={setResolutionNote} multiline />
            <Text style={styles.actionHelp}>
              只能恢复到服务端保存的安全检查点：
              {safeResumeStatus(row.fundsRoute, row.resumeStatus)}。敏感阶段会退回收款复核，重新筛查与对账。
            </Text>
            <ActionButton
              label="恢复原步骤"
              primary
              disabled={busy || !hasTotp || resolutionNote.trim().length < 3}
              onPress={() =>
                resolveException.mutate(
                  {
                    ...ref,
                    resolutionNote,
                    nextStatus: safeResumeStatus(
                      row.fundsRoute,
                      row.resumeStatus,
                    ),
                    totpCode,
                  },
                  { onSuccess: sensitiveSuccess },
                )
              }
            />
          </View>
        </AdminSection>
      ) : null}

      {!(["CREDITED", "CANCELLED", "EXCEPTION"] as string[]).includes(row.status) ? (
        <AdminSection title="标记异常" meta="NO AUTOMATIC ASSUMPTIONS">
          <View style={styles.actionCard}>
            <Field label="异常原因" value={exceptionReason} onChange={setExceptionReason} multiline />
            <ActionButton
              label="暂停流程并建立异常记录"
              danger
              disabled={busy || exceptionReason.trim().length < 3}
              onPress={() =>
                markException.mutate(
                  { ...ref, reason: exceptionReason },
                  { onSuccess: refresh },
                )
              }
            />
          </View>
        </AdminSection>
      ) : null}

      {mutationError ? <Text style={styles.errorText}>{mutationError}</Text> : null}

      <AdminSection title="审计事件" meta={`${row.events.length} EVENTS`}>
        <View style={styles.events}>
          {row.events.map(
            (event: {
              id: number;
              eventType: string;
              fromStatus: string | null;
              toStatus: string | null;
              createdAt: Date | string;
            }) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.eventType}>{event.eventType}</Text>
              <Text style={styles.eventState}>
                {event.fromStatus ?? "—"} → {event.toStatus ?? "—"}
              </Text>
              <Text style={styles.eventTime}>{String(event.createdAt)}</Text>
            </View>
            ),
          )}
        </View>
      </AdminSection>
    </AdminPageChrome>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text selectable={mono} style={[styles.infoValue, mono && styles.mono]} numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, multiline && styles.inputMultiline, mono && styles.mono]}
      />
    </View>
  );
}

function NetworkPicker({
  value,
  onChange,
}: {
  value: BrokerFundingNetwork;
  onChange: (value: BrokerFundingNetwork) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      {BROKER_FUNDING_NETWORKS.map((item) => (
        <ChoiceButton
          key={item}
          label={item}
          active={value === item}
          onPress={() => onChange(item)}
        />
      ))}
    </View>
  );
}

function ChoiceRow<T extends string>({
  values,
  value,
  onChange,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      {values.map((item) => (
        <ChoiceButton
          key={item}
          label={item}
          active={value === item}
          onPress={() => onChange(item)}
        />
      ))}
    </View>
  );
}

function ChoiceButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  primary = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        primary && styles.actionButtonPrimary,
        danger && styles.actionButtonDanger,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          primary && styles.actionButtonTextPrimary,
          danger && styles.actionButtonTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function normalizeAmount(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? String(Math.round(number * 1_000_000) / 1_000_000)
    : "";
}

function isFutureDate(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function defaultDirectInstructionExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000 - 60_000).toISOString();
}

function isValidDirectInstructionExpiry(value: string) {
  const timestamp = new Date(value).getTime();
  const remaining = timestamp - Date.now();
  return (
    Number.isFinite(timestamp) &&
    remaining >= 5 * 60 * 1000 &&
    remaining <= 24 * 60 * 60 * 1000
  );
}

type SafeResumeStatus =
  | "WAITING_ACCOUNT"
  | "WAITING_INSTRUCTIONS"
  | "READY_TO_FUND"
  | "TX_SUBMITTED"
  | "RECEIVED";

function safeResumeStatus(
  fundsRoute: string,
  resumeStatus?: string | null,
): SafeResumeStatus {
  const directStatuses: SafeResumeStatus[] = [
    "WAITING_ACCOUNT",
    "WAITING_INSTRUCTIONS",
    "READY_TO_FUND",
    "TX_SUBMITTED",
  ];
  const collectionStatuses: SafeResumeStatus[] = [
    ...directStatuses,
    "RECEIVED",
  ];
  const allowed =
    fundsRoute === "BROKER_DIRECT" ? directStatuses : collectionStatuses;
  return allowed.includes(resumeStatus as SafeResumeStatus)
    ? (resumeStatus as SafeResumeStatus)
    : fundsRoute === "BROKER_DIRECT"
      ? "TX_SUBMITTED"
      : "RECEIVED";
}

function activationBlockers(readiness: {
  providerActivationBlocked: boolean;
  unavailableStrategyIds: string[];
  nonLiveStrategyIds: string[];
  uncoveredStrategyIds: string[];
  unverifiedSlots: string[];
  collectionApprovalBlockedBrokers: string[];
}) {
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
  return id === "exness"
    ? "Exness"
    : id === "ic-markets"
      ? "IC Markets"
      : id === "blueberry-markets"
        ? "Blueberry Markets"
        : id;
}

const styles = StyleSheet.create({
  center: { minHeight: 240, alignItems: "center", justifyContent: "center" },
  backButton: { minHeight: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(148,163,184,0.2)", borderRadius: 4, alignItems: "center", justifyContent: "center" },
  backText: { color: "#CBD5E1", fontSize: 10, fontWeight: "800" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoCard: { flex: 1, minWidth: 210, padding: 11, borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", borderRadius: 5, backgroundColor: "rgba(15,23,42,0.64)", gap: 5 },
  infoLabel: { color: "#64748B", fontSize: 9, fontWeight: "800" },
  attestationRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 9, borderWidth: 1, borderColor: "rgba(96,165,250,0.22)", borderRadius: 4, backgroundColor: "rgba(59,130,246,0.06)" },
  attestationMark: { color: "#93C5FD", fontSize: 17, lineHeight: 20 },
  attestationText: { flex: 1, color: "#A5B4FC", fontSize: 10, lineHeight: 16, fontWeight: "700" },
  infoValue: { color: "#F8FAFC", fontSize: 10, lineHeight: 15, fontWeight: "800" },
  mono: { fontFamily: "monospace" },
  safetyNotice: { marginTop: 9, padding: 12, borderWidth: 1, borderColor: "rgba(52,211,153,0.3)", borderRadius: 5, gap: 4 },
  safetyTitle: { color: "#34D399", fontSize: 10, fontWeight: "900" },
  safetyText: { color: "#94A3B8", fontSize: 9, lineHeight: 15 },
  actionCard: { padding: 13, borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", borderRadius: 5, backgroundColor: "rgba(9,15,28,0.7)", gap: 10 },
  actionTitle: { color: "#F8FAFC", fontSize: 12, fontWeight: "900" },
  actionHelp: { color: "#94A3B8", fontSize: 9, lineHeight: 15 },
  field: { gap: 5 },
  fieldLabel: { color: "#94A3B8", fontSize: 9, fontWeight: "800" },
  input: { minHeight: 40, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(148,163,184,0.24)", borderRadius: 4, color: "#F8FAFC", fontSize: 10, backgroundColor: "rgba(2,6,23,0.55)" },
  inputMultiline: { minHeight: 78, paddingTop: 10, textAlignVertical: "top" },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  choice: { minHeight: 32, paddingHorizontal: 9, borderWidth: 1, borderColor: "rgba(148,163,184,0.2)", borderRadius: 4, alignItems: "center", justifyContent: "center" },
  choiceActive: { borderColor: "rgba(216,188,131,0.72)", backgroundColor: "rgba(216,188,131,0.08)" },
  choiceText: { color: "#94A3B8", fontSize: 8, fontWeight: "800" },
  choiceTextActive: { color: "#D8BC83" },
  actionButton: { minHeight: 38, paddingHorizontal: 12, borderWidth: 1, borderColor: "rgba(148,163,184,0.26)", borderRadius: 4, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  actionButtonPrimary: { backgroundColor: "#D8BC83", borderColor: "#D8BC83" },
  actionButtonDanger: { borderColor: "rgba(248,113,113,0.55)", backgroundColor: "rgba(248,113,113,0.08)" },
  actionButtonText: { color: "#E2E8F0", fontSize: 9, fontWeight: "900" },
  actionButtonTextPrimary: { color: "#050810" },
  actionButtonTextDanger: { color: "#F87171" },
  addressList: { gap: 7 },
  addressRow: { padding: 9, borderWidth: 1, borderColor: "rgba(148,163,184,0.16)", borderRadius: 4, flexDirection: "row", alignItems: "center", gap: 10 },
  addressCopy: { flex: 1, minWidth: 0, gap: 3 },
  addressTitle: { color: "#E2E8F0", fontSize: 9, fontWeight: "900" },
  addressValue: { color: "#64748B", fontSize: 8, fontFamily: "monospace" },
  events: { gap: 6 },
  eventRow: { padding: 10, borderWidth: 1, borderColor: "rgba(148,163,184,0.14)", borderRadius: 4, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  eventType: { minWidth: 210, flex: 1, color: "#F8FAFC", fontSize: 9, fontWeight: "900" },
  eventState: { color: "#D8BC83", fontSize: 8, fontWeight: "800" },
  eventTime: { color: "#64748B", fontSize: 8 },
  errorText: { color: "#F87171", fontSize: 10, lineHeight: 16, marginBottom: 16 },
  blockedText: { color: "#FBBF24", fontSize: 9, lineHeight: 15, fontWeight: "800" },
  disabled: { opacity: 0.36 },
  totpInput: { maxWidth: 260, letterSpacing: 8, fontSize: 15, fontWeight: "900" },
});
