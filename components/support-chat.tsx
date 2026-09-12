/**
 * 商品页的在线咨询面板。
 *
 * 产品口径，几条都不能动：
 *   - 打开面板**什么都不写**。不建会话、不发问候、不进后台线索列表。
 *     只有客户点了发送，服务端才落库。
 *   - 自动回复必须一眼看出是机器人：气泡上有「自动值守 · 机器人」角标，
 *     正文第一行也写明。不做「模拟正在输入」这类让人误以为是真人的效果。
 *   - 真人回复后客户不用刷新：面板展开时按固定间隔轮询增量。
 *   - 发送失败时输入框里的字要还回去，不能吞掉客户刚打的内容。
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
import { trpc } from "@/lib/trpc";
import { getVisitorToken, newClientMsgId } from "@/lib/support-visitor";
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
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publicNo, setPublicNo] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!active || visitorToken) return;
    let cancelled = false;
    void getVisitorToken().then((token) => {
      if (!cancelled) setVisitorToken(token);
    });
    return () => {
      cancelled = true;
    };
  }, [active, visitorToken]);

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

  useEffect(() => {
    if (!thread.data) return;
    if (thread.data.conversation) setPublicNo(thread.data.conversation.publicNo);
    if (thread.data.messages.length) {
      setMessages((previous) => mergeMessages(previous, thread.data!.messages));
    }
  }, [thread.data]);

  const utils = trpc.useUtils();
  const sendMutation = trpc.support.send.useMutation({
    onSuccess: (data) => {
      setMessages((previous) => mergeMessages(previous, data.messages));
      setPublicNo(data.conversation.publicNo);
      setError(null);
      void utils.support.thread.invalidate();
    },
  });

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sendMutation.isPending) return;
    const token = visitorToken ?? (await getVisitorToken());
    if (!visitorToken) setVisitorToken(token);
    // 先不清空输入框：失败时客户打的字必须还在。
    try {
      await sendMutation.mutateAsync({
        visitorToken: token,
        clientMsgId: newClientMsgId(),
        body,
        strategyId: strategyId ?? null,
        pageUrl: pageUrl ?? null,
        locale: "zh",
      });
      setDraft("");
    } catch (err: any) {
      setError(err?.message || "发送失败，请稍后再试");
    }
  }, [draft, pageUrl, sendMutation, strategyId, visitorToken]);

  useEffect(() => {
    if (!messages.length) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const qqLine = entry.data?.qqLine || "";
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
          {`先由${SUPPORT_AUTO_DISCLOSURE.zh}接待，真人顾问看到后会在同一个会话里接手。双方的消息都留在这里，刷新或换天再来都读得到。`}
        </Text>
      </View>

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
