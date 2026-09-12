/**
 * 商品页的在线咨询面板。
 *
 * 产品口径，几条都不能动：
 *   - 打开面板**什么都不写**。不建会话、不发问候、不进后台线索列表。
 *     只有客户点了发送，服务端才落库。
 *   - 自动回复必须一眼看出是机器人：气泡上有「自动值守 · 机器人」角标，
 *     正文第一行也写明。不做「模拟正在输入」这类让人误以为是真人的效果。
 *   - 真人回复后客户不用刷新：面板展开时按固定间隔轮询增量。
 *   - 发送失败时输入框里的字要还回去，不能吞掉客户刚打的内容；
 *     改了内容再发就是**另一条**，绝不用上一次的幂等键把新正文吞掉（见 pendingAttempt）。
 *   - QQ 入口始终在面板里，鼓励走 QQ 继续聊。
 */

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { V2 } from "@/components/v2/tokens";
import { readableSupportError } from "@/lib/support-error-text";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import {
  ensureVisitorToken,
  forgetPreviousVisitorToken,
  identityKeyFor,
  newClientMsgId,
  rotateVisitorToken,
} from "@/lib/support-visitor";
import {
  SUPPORT_AUTO_DISCLOSURE,
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_POLL_INTERVAL_MS,
  type SupportMessageView,
} from "@/shared/support/contracts";

type SupportChatProps = {
  /** 面板是否处于可见状态；不可见时停止轮询。 */
  active: boolean;
  strategyId?: number | null;
  strategyTitle?: string | null;
  pageUrl?: string | null;
};

const ROLE_LABEL: Record<SupportMessageView["role"], string> = {
  customer: "你",
  auto: "自动值守 · 机器人",
  operator: "EAXAU 顾问（真人）",
};

function mergeMessages(previous: SupportMessageView[], incoming: SupportMessageView[]) {
  // 按 id 去重合并：增量查询带了时间重叠窗口，重复条目是预期内的。
  const byId = new Map<number, SupportMessageView>();
  for (const message of previous) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function SupportChat({ active, strategyId, strategyTitle, pageUrl }: SupportChatProps) {
  const { user, loading: authLoading } = useAuth();
  const identity = identityKeyFor(user);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [claimableToken, setClaimableToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publicNo, setPublicNo] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  /**
   * 正在飞行 / 刚失败的那一次发送尝试：**幂等键和它当时的正文绑在一起**。
   *
   * 复核回合 2 的 P2：只存一个键是不够的。客户点发送 → 服务端已经落库 → 响应丢了 →
   * 客户看到「再试一次」→ **改了内容**再点 → 旧键 + 新正文 → 服务端命中唯一索引走幂等分支 →
   * 返回旧正文、`duplicate=true` → 客户端当成功清空草稿。客户补的那段话一个字都没进库，
   * 接口还报成功。
   *
   * 现在的规则：
   *   - 正文没变 = 重试同一条 → 复用同一个键，**而且用当初那份正文发**（键与正文永远对应）；
   *   - 正文变了 = 客户有意发新内容 → **新键**，同时把上一次那条标成「待确认」并在界面上说清楚
   *     （它可能已经落库了），绝不用旧键把新正文吞掉。
   */
  const pendingAttempt = useRef<{ clientMsgId: string; body: string } | null>(null);
  /** 上一次尝试改内容后变成「不知道到没到」的状态，界面要明说，并给一个重发原文的出口。 */
  const [unresolvedAttempt, setUnresolvedAttempt] = useState<
    { clientMsgId: string; body: string; landed: boolean } | null
  >(null);
  /** 防止「换令牌 → 再被判 foreign → 再换」打转，一个挂载周期最多换两次。 */
  const rotations = useRef(0);

  // 身份变了（登录 / 登出 / 换账号）就换一枚新访客令牌，并清掉本地已渲染的消息。
  // 这台电脑上的上一位说过什么，下一位一个字都看不到。
  useEffect(() => {
    if (!active || authLoading) return;
    let cancelled = false;
    void ensureVisitorToken(identity).then((result) => {
      if (cancelled) return;
      setVisitorToken((current) => {
        if (current && current !== result.token) {
          setMessages([]);
          setPublicNo(null);
        }
        return result.token;
      });
      setClaimableToken(result.previousToken);
    });
    return () => {
      cancelled = true;
    };
  }, [active, authLoading, identity]);

  const entry = trpc.support.entry.useQuery(undefined, { enabled: active });

  const lastId = messages.length ? messages[messages.length - 1].id : 0;

  // 轮询只在面板展开时进行；afterId 用增量游标，服务端另带时间重叠窗口兜底。
  const thread = trpc.support.thread.useQuery(
    {
      visitorToken: visitorToken ?? "",
      strategyId: strategyId ?? null,
      afterId: lastId,
    },
    {
      enabled: active && Boolean(visitorToken),
      refetchInterval: active ? SUPPORT_POLL_INTERVAL_MS : false,
      refetchOnWindowFocus: true,
    },
  );

  const rotateIdentity = useCallback(async () => {
    if (rotations.current >= 2) return null;
    rotations.current += 1;
    const next = await rotateVisitorToken(identity);
    setVisitorToken(next.token);
    setMessages([]);
    setPublicNo(null);
    return next.token;
  }, [identity]);

  useEffect(() => {
    if (!thread.data) return;
    // 服务端说这条线不属于当前身份：不报错、不卡死，换一枚令牌重新开一条。
    if (thread.data.identity === "rotate") {
      void rotateIdentity();
      return;
    }
    // 登录身份遇到本机的匿名记录：等客户点「并入我的账号」才给看，不自动继承。
    if (thread.data.identity === "claimable") {
      setMessages([]);
      setPublicNo(null);
      return;
    }
    if (thread.data.conversation) setPublicNo(thread.data.conversation.publicNo);
    if (thread.data.messages.length) {
      setMessages((previous) => mergeMessages(previous, thread.data!.messages));
    }
  }, [rotateIdentity, thread.data]);

  // 待确认那条到底有没有落库，用它自己的 clientMsgId 在线程里查——不靠正文猜。
  useEffect(() => {
    if (!unresolvedAttempt || unresolvedAttempt.landed) return;
    const landed = messages.some(
      (message) =>
        message.role === "customer" && message.clientMsgId === unresolvedAttempt.clientMsgId,
    );
    if (landed) setUnresolvedAttempt({ ...unresolvedAttempt, landed: true });
  }, [messages, unresolvedAttempt]);

  const utils = trpc.useUtils();
  const sendMutation = trpc.support.send.useMutation();
  const claimMutation = trpc.support.claim.useMutation();

  const handleSend = useCallback(async () => {
    const typed = draft.trim();
    if (!typed || sendMutation.isPending) return;
    let token = visitorToken;
    if (!token) {
      token = (await ensureVisitorToken(identity)).token;
      setVisitorToken(token);
    }

    let attempt = pendingAttempt.current;
    if (attempt && attempt.body !== typed) {
      // 客户改了内容再发。上一次那条**可能已经落库**了（响应丢了而已），
      // 所以这次必须是一条新消息、用新键；同时把上一次标成待确认，界面上说清楚。
      setUnresolvedAttempt({ ...attempt, landed: false });
      attempt = null;
    }
    if (!attempt) attempt = { clientMsgId: newClientMsgId(), body: typed };
    pendingAttempt.current = attempt;
    const sending = attempt;

    const submit = async (withToken: string) =>
      sendMutation.mutateAsync({
        visitorToken: withToken,
        clientMsgId: sending.clientMsgId,
        // 用这次尝试**当初记下的正文**，不是当前草稿：键和正文必须永远对得上。
        body: sending.body,
        strategyId: strategyId ?? null,
        pageUrl: pageUrl ?? null,
        locale: "zh",
      });

    try {
      let data;
      try {
        data = await submit(token);
      } catch (err: any) {
        // 身份对不上：换一枚令牌开新线，然后用**同一个 clientMsgId** 再发一次。
        if (err?.data?.code === "CONFLICT") {
          const rotated = await rotateIdentity();
          if (!rotated) throw err;
          data = await submit(rotated);
        } else {
          throw err;
        }
      }
      setMessages((previous) => mergeMessages(previous, data.messages));
      setPublicNo(data.conversation.publicNo);
      setError(null);
      pendingAttempt.current = null;

      if (data.duplicate && data.bodyMismatch) {
        // 服务端的第二道：这个幂等键早就落过库了，而且正文和这次提交的不一样 ——
        // 这次的内容一个字都没进库。**不能清空草稿**，要如实告诉客户再发一次。
        setUnresolvedAttempt({ ...sending, landed: true });
        setError(
          "刚才那条已经在记录里了，这次改后的内容还没发出去——请再点一次发送。",
        );
        return;
      }

      // 只有草稿还是这次发出去的那份时才清空——客户在请求飞行期间改过的字不能被抹掉。
      setDraft((current) => (current.trim() === sending.body ? "" : current));
      void utils.support.thread.invalidate();
    } catch (err: any) {
      // 草稿和这次尝试都保留：客户再点一次是**重试同一条**，不会变成第二条消息。
      setError(readableSupportError(err));
    }
  }, [draft, identity, pageUrl, rotateIdentity, sendMutation, strategyId, utils, visitorToken]);

  /** 把待确认那条的原文放回输入框并复用原键——重试对应的就是原文那一条。 */
  const handleResendUnresolved = useCallback(() => {
    if (!unresolvedAttempt) return;
    pendingAttempt.current = {
      clientMsgId: unresolvedAttempt.clientMsgId,
      body: unresolvedAttempt.body,
    };
    setDraft(unresolvedAttempt.body);
    setUnresolvedAttempt(null);
    setError(null);
  }, [unresolvedAttempt]);

  const handleClaim = useCallback(
    async (accept: boolean) => {
      const previous = claimableToken;
      setClaimableToken(null);
      await forgetPreviousVisitorToken();
      if (!accept || !previous || !visitorToken) return;
      try {
        const result = await claimMutation.mutateAsync({
          previousVisitorToken: previous,
          visitorToken,
          strategyId: strategyId ?? null,
        });
        if (result.claimed) {
          setMessages(result.messages);
          setPublicNo(result.conversation.publicNo);
          setError(null);
        }
        void utils.support.thread.invalidate();
      } catch (err: any) {
        setError(readableSupportError(err));
      }
    },
    [claimMutation, claimableToken, strategyId, utils, visitorToken],
  );

  useEffect(() => {
    if (!messages.length) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const qqLine = entry.data?.qqLine || "";
  const attendanceNote =
    entry.data?.attendanceNote ?? "留言会存下来，顾问看到后在这里回你。";
  const remaining = SUPPORT_MESSAGE_MAX_LENGTH - draft.length;

  const intro = useMemo(() => {
    const product = strategyTitle?.trim();
    return product
      ? `正在咨询：${product}${strategyId ? `（商品编号 ${strategyId}）` : ""}`
      : "正在咨询：通用授权与部署问题";
  }, [strategyId, strategyTitle]);

  return (
    <View style={styles.wrap}>
      <View style={styles.noticeBox}>
        <MaterialIcons name="smart-toy" size={15} color={V2.blue} />
        <Text style={styles.noticeText}>
          {/* 值守说法跟着服务端的真实开关走：提醒通道没开就只说「留言」，不说「有人看着」。 */}
          {`先由${SUPPORT_AUTO_DISCLOSURE.zh}接待。${attendanceNote}双方的消息都留在这里，刷新或换天再来都读得到。`}
        </Text>
      </View>

      {claimableToken ? (
        <View style={styles.claimBox}>
          <Text style={styles.claimText}>
            这台设备上有一段以访客身份留下的咨询记录。要并入你现在登录的账号吗？
            不并入的话它会留在原处，你这边从一条新会话开始。
          </Text>
          <View style={styles.claimActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleClaim(true)}
              style={({ pressed }) => [styles.claimPrimary, pressed && styles.pressed]}
            >
              <Text style={styles.claimPrimaryText}>并入我的账号</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleClaim(false)}
              style={({ pressed }) => [styles.claimGhost, pressed && styles.pressed]}
            >
              <Text style={styles.claimGhostText}>不用，开新会话</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaText} numberOfLines={1}>
          {intro}
        </Text>
        {publicNo ? <Text style={styles.metaNo}>会话 {publicNo}</Text> : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>直接把问题打出来就行</Text>
            <Text style={styles.emptyText}>
              比如「这个能绑几个账户」「MT5 装不上怎么办」「报价怎么算」。
              {"\n"}
              你发出第一条之前，我们这边不会留下任何记录。
            </Text>
          </View>
        ) : (
          messages.map((message) => {
            const mine = message.role === "customer";
            return (
              <View
                key={message.id}
                style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
              >
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <View style={styles.bubbleHead}>
                    {message.role === "auto" ? (
                      <MaterialIcons name="smart-toy" size={12} color={V2.blue} />
                    ) : message.role === "operator" ? (
                      <MaterialIcons name="support-agent" size={12} color={V2.gold} />
                    ) : null}
                    <Text
                      style={[
                        styles.bubbleRole,
                        message.role === "auto" && styles.bubbleRoleAuto,
                        message.role === "operator" && styles.bubbleRoleOperator,
                      ]}
                    >
                      {ROLE_LABEL[message.role]}
                    </Text>
                  </View>
                  <Text style={styles.bubbleText} selectable>
                    {message.body}
                  </Text>
                </View>
              </View>
            );
          })
        )}
        {thread.isLoading && messages.length === 0 ? (
          <ActivityIndicator size="small" color={V2.gold} style={styles.threadLoading} />
        ) : null}
      </ScrollView>

      {unresolvedAttempt ? (
        <View style={styles.unresolvedBox}>
          <MaterialIcons
            name={unresolvedAttempt.landed ? "check-circle" : "help-outline"}
            size={14}
            color={unresolvedAttempt.landed ? V2.green : V2.blue}
          />
          <View style={styles.unresolvedBody}>
            <Text style={styles.unresolvedText}>
              {unresolvedAttempt.landed
                ? `你之前那条「${unresolvedAttempt.body.slice(0, 18)}${
                    unresolvedAttempt.body.length > 18 ? "…" : ""
                  }」已经确认送到了，就在上面的记录里。这次改后的内容会另发一条。`
                : `你之前那条「${unresolvedAttempt.body.slice(0, 18)}${
                    unresolvedAttempt.body.length > 18 ? "…" : ""
                  }」已经提交过一次，我们还没确认它有没有送到——它如果到了会出现在上面的记录里。` +
                  `你改后的内容会另发一条，不会顶掉那一条。`}
            </Text>
            <View style={styles.unresolvedActions}>
              {!unresolvedAttempt.landed ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleResendUnresolved}
                  style={({ pressed }) => [styles.unresolvedAction, pressed && styles.pressed]}
                >
                  <Text style={styles.unresolvedActionText}>重发原来那条</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => setUnresolvedAttempt(null)}
                style={({ pressed }) => [styles.unresolvedAction, pressed && styles.pressed]}
              >
                <Text style={styles.unresolvedActionText}>知道了</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="error-outline" size={14} color={V2.red} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={(value) => setDraft(value.slice(0, SUPPORT_MESSAGE_MAX_LENGTH))}
          placeholder="说说你想确认的版本、账户数或安装环境"
          placeholderTextColor={V2.textMuted}
          multiline
          style={styles.input}
          editable={!sendMutation.isPending}
          // multiline 的 onSubmitEditing 在 RN-Web 上不会触发（渲染成 textarea），
          // 所以网页端自己接 keydown：Enter 发送，Shift+Enter 换行。
          onKeyPress={(event: any) => {
            if (Platform.OS !== "web") return;
            const native = event?.nativeEvent;
            if (native?.key === "Enter" && !native?.shiftKey) {
              event.preventDefault?.();
              void handleSend();
            }
          }}
          onSubmitEditing={() => void handleSend()}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="发送咨询消息"
          disabled={!draft.trim() || sendMutation.isPending}
          onPress={() => void handleSend()}
          style={({ pressed }) => [
            styles.sendButton,
            (!draft.trim() || sendMutation.isPending) && styles.sendButtonDisabled,
            pressed && styles.pressed,
          ]}
        >
          {sendMutation.isPending ? (
            <ActivityIndicator size="small" color={V2.background} />
          ) : (
            <MaterialIcons name="send" size={16} color={V2.background} />
          )}
        </Pressable>
      </View>
      <Text style={styles.counter}>
        {remaining < 200 ? `还可以输入 ${remaining} 字` : `单条最多 ${SUPPORT_MESSAGE_MAX_LENGTH} 字`}
      </Text>

      {qqLine ? (
        <View style={styles.qqBox}>
          <MaterialIcons name="forum" size={15} color={V2.gold} />
          <Text style={styles.qqText} selectable>
            {qqLine}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, gap: 10 },
  noticeBox: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(88,150,220,0.32)",
    borderRadius: 5,
    backgroundColor: "rgba(88,150,220,0.08)",
  },
  noticeText: { flex: 1, color: V2.textMuted, fontSize: 11, lineHeight: 17 },
  claimBox: {
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.42)",
    borderRadius: 5,
    backgroundColor: "rgba(216,188,131,0.08)",
  },
  claimText: { color: V2.text, fontSize: 11, lineHeight: 17 },
  claimActions: { flexDirection: "row", gap: 8 },
  claimPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    backgroundColor: V2.gold,
  },
  claimPrimaryText: { color: V2.background, fontSize: 11, fontWeight: "800" },
  claimGhost: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: V2.border,
  },
  claimGhostText: { color: V2.textMuted, fontSize: 11, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText: { flex: 1, color: V2.text, fontSize: 11, fontWeight: "700" },
  metaNo: { color: V2.textMuted, fontSize: 10, fontWeight: "700" },
  thread: {
    maxHeight: Platform.OS === "web" ? 280 : 240,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  threadContent: { padding: 10, gap: 8 },
  threadLoading: { marginTop: 10 },
  emptyBox: { paddingVertical: 16, gap: 6 },
  emptyTitle: { color: V2.text, fontSize: 12, fontWeight: "800" },
  emptyText: { color: V2.textMuted, fontSize: 11, lineHeight: 17 },
  bubbleRow: { flexDirection: "row" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowTheirs: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "88%",
    padding: 9,
    borderWidth: 1,
    borderRadius: 5,
    gap: 4,
  },
  bubbleMine: {
    borderColor: "rgba(216,188,131,0.42)",
    backgroundColor: "rgba(216,188,131,0.09)",
  },
  bubbleTheirs: {
    borderColor: V2.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  bubbleHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  bubbleRole: { color: V2.textMuted, fontSize: 9, fontWeight: "900" },
  bubbleRoleAuto: { color: V2.blue },
  bubbleRoleOperator: { color: V2.gold },
  bubbleText: { color: V2.text, fontSize: 12, lineHeight: 19 },
  unresolvedBox: {
    flexDirection: "row",
    gap: 8,
    padding: 9,
    borderWidth: 1,
    borderColor: "rgba(88,150,220,0.32)",
    borderRadius: 5,
    backgroundColor: "rgba(88,150,220,0.07)",
  },
  unresolvedBody: { flex: 1, gap: 6 },
  unresolvedText: { color: V2.textMuted, fontSize: 11, lineHeight: 17 },
  unresolvedActions: { flexDirection: "row", gap: 8 },
  unresolvedAction: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
  },
  unresolvedActionText: { color: V2.text, fontSize: 10, fontWeight: "700" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { color: V2.red, fontSize: 11, flex: 1 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 96,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 5,
    color: V2.text,
    fontSize: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  sendButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5,
    backgroundColor: V2.gold,
  },
  sendButtonDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  counter: { color: V2.textMuted, fontSize: 10 },
  qqBox: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.32)",
    borderRadius: 5,
    backgroundColor: "rgba(216,188,131,0.06)",
  },
  qqText: { flex: 1, color: V2.text, fontSize: 11, lineHeight: 17 },
});
