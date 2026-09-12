/**
 * 后台 · 网页咨询。
 *
 * 这个页面必须存在：Telegram 提醒里给出的链接就是 /admin/support?no=EAX-xxxx。
 * 通知里只有摘要，正文只能在这里看 —— 页面缺了，等于提醒发出去却没有落脚点。
 *
 * 能做的事：看待处理会话、读完整双方历史、以真人身份回复、标记已处理，
 * 以及查看 Telegram 提醒的真实投递状态（held / pending / failed 都直接显示，不静默）。
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useLocalSearchParams } from "expo-router";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
import { useColors } from "@/hooks/use-colors";
import { adminMutation, adminQuery } from "@/lib/admin-api";
import { SUPPORT_MESSAGE_MAX_LENGTH } from "@/shared/support/contracts";
import { newClientMsgId } from "@/lib/support-visitor";

/** 后台看会话详情的自动刷新间隔；客户端是 5 秒，运营这边不用那么密。 */
const ADMIN_THREAD_POLL_MS = 10_000;

type ConversationItem = {
  id: number;
  publicNo: string;
  status: "open" | "answered" | "closed";
  strategyId: number | null;
  strategyTitle: string | null;
  identity: "guest" | "member";
  customerMessageCount: number;
  operatorMessageCount: number;
  /** 真人手动接管中：访客再发消息只落库 + 提醒，机器人不再自动答。 */
  operatorTakeover: boolean;
  lastMessageAt: string;
  pageUrl: string | null;
  notifyStatus: string | null;
  notifyAttempts: number;
  notifyError: string | null;
};

type MessageItem = {
  id: number;
  role: "customer" | "auto" | "operator";
  body: string;
  autoRuleKey: string | null;
  createdAt: string;
};

const STATUS_FILTERS = [
  { key: "open" as const, label: "待回复" },
  { key: "answered" as const, label: "已回复" },
  { key: "closed" as const, label: "已关闭" },
  { key: "all" as const, label: "全部" },
];

const ROLE_LABEL: Record<MessageItem["role"], string> = {
  customer: "客户",
  auto: "自动值守（机器人）",
  // 客户那一侧的标签同步改成了「运营回复（后台发出）」：后台这条回复到底是谁打的字，
  // 系统证不出来，就不替它认领「某位真人顾问」的身份。这里跟着用同一个说法。
  operator: "我方运营回复",
};

const NOTIFY_LABEL: Record<string, string> = {
  pending: "排队中",
  sending: "投递中",
  sent: "已发出",
  held: "未开启投递（held）",
  failed: "投递失败",
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export default function AdminSupportScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ no?: string }>();
  const [status, setStatus] = useState<"open" | "answered" | "closed" | "all">("open");
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  /** 当前打开这条会话的接管状态，决定右下角那个按钮是「接管」还是「交还自动接待」。 */
  const [threadTakeover, setThreadTakeover] = useState(false);
  const [isTogglingAssist, setIsTogglingAssist] = useState(false);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notify, setNotify] = useState<{ mode: string; hasToken: boolean; hasChatId: boolean } | null>(
    null,
  );
  /** 运营这条回复的幂等键：发送失败后再点，是重试同一条，不会变成两条。 */
  const pendingReplyId = useRef<string | null>(null);

  const loadList = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminQuery("supportAdmin.list", { status, limit: 50, offset: 0 });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total ?? 0));
      setError(null);
    } catch (err: any) {
      setError(err?.message || "加载会话列表失败");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  const loadThread = useCallback(async (publicNo: string) => {
    setIsThreadLoading(true);
    try {
      const data = await adminQuery("supportAdmin.thread", { publicNo });
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setThreadTakeover(Boolean(data?.conversation?.operatorTakeover));
      setSelected(publicNo);
      pendingReplyId.current = null;
      setError(null);
    } catch (err: any) {
      setError(err?.message || "加载会话内容失败");
      setMessages([]);
    } finally {
      setIsThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // 会话详情自动刷新：客户在运营看着页面时发来的新消息，不用手点一下才出现。
  useEffect(() => {
    if (!selected) return;
    const timer = setInterval(() => {
      void adminQuery("supportAdmin.thread", { publicNo: selected })
        .then((data) => {
          if (Array.isArray(data?.messages)) setMessages(data.messages);
          if (data?.conversation) setThreadTakeover(Boolean(data.conversation.operatorTakeover));
        })
        .catch(() => {
          // 轮询失败不打断运营正在写的回复，下一轮再说
        });
    }, ADMIN_THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [selected]);

  useEffect(() => {
    void adminQuery("supportAdmin.notifyStatus")
      .then((data) => setNotify(data ?? null))
      .catch(() => setNotify(null));
  }, []);

  // 从 Telegram 提醒点进来时直接打开对应会话。
  useEffect(() => {
    const no = typeof params.no === "string" ? params.no.trim() : "";
    if (no && no !== selected) void loadThread(no);
    // selected 故意不进依赖：只在链接参数变化时跳转，之后不抢用户的选择
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.no, loadThread]);

  const handleReply = async () => {
    const body = draft.trim();
    if (!body || !selected || isSending) return;
    setIsSending(true);
    if (!pendingReplyId.current) pendingReplyId.current = newClientMsgId();
    try {
      const data = await adminMutation("supportAdmin.reply", {
        publicNo: selected,
        body,
        clientMsgId: pendingReplyId.current,
      });
      setMessages(Array.isArray(data?.messages) ? data.messages : messages);
      // 回复本身就是接管：服务端在同一个事务里把自动接待关掉了，这里只是把结果显示出来。
      setThreadTakeover(Boolean(data?.conversation?.operatorTakeover ?? true));
      pendingReplyId.current = null;
      setDraft("");
      setError(null);
      void loadList();
    } catch (err: any) {
      // 失败时保留草稿和幂等键：运营再点一次是重试同一条，不会重复发给客户。
      setError(err?.message || "回复失败，请重试");
    } finally {
      setIsSending(false);
    }
  };

  /**
   * 交还 / 收回自动接待。
   *
   * 「交还自动接待」是这套接管语义里唯一需要人点的动作：运营一旦在会话里回过话，
   * 机器人就不再插话，直到这里明确把它交还回去。
   */
  const handleAutoAssist = async (enabled: boolean) => {
    if (!selected || isTogglingAssist) return;
    setIsTogglingAssist(true);
    try {
      const data = await adminMutation("supportAdmin.setAutoAssist", {
        publicNo: selected,
        enabled,
      });
      setThreadTakeover(Boolean(data?.conversation?.operatorTakeover ?? !enabled));
      setError(null);
      void loadList();
    } catch (err: any) {
      setError(err?.message || "切换自动接待失败");
    } finally {
      setIsTogglingAssist(false);
    }
  };

  const handleStatus = async (next: "open" | "answered" | "closed") => {
    if (!selected) return;
    try {
      await adminMutation("supportAdmin.setStatus", { publicNo: selected, status: next });
      void loadList();
    } catch (err: any) {
      setError(err?.message || "状态更新失败");
    }
  };

  const handleDrain = async () => {
    try {
      const data = await adminMutation("supportAdmin.drain");
      setError(
        `外发箱：模式 ${data?.mode ?? "?"} · 认领 ${data?.claimed ?? 0} · 已发 ${data?.sent ?? 0} · 未开启 ${data?.held ?? 0} · 待重投 ${data?.retried ?? 0} · 失败 ${data?.failed ?? 0}`,
      );
      void loadList();
    } catch (err: any) {
      setError(err?.message || "推送外发箱失败");
    }
  };

  const pending = items.filter((item) => item.status === "open").length;

  return (
    <AdminPageChrome
      eyebrow="CUSTOMER DESK"
      title="网页咨询"
      subtitle="客户在商品页发起的会话。机器人先值守，真人在这里接手；双方消息都留档。"
      metrics={[
        { label: "本页会话", value: items.length },
        { label: "待回复", value: pending },
        { label: "总计", value: total },
        { label: "Telegram 提醒", value: notify?.mode === "live" ? "已开启" : "未开启" },
      ]}
    >
      {notify && notify.mode !== "live" ? (
        <View style={[styles.banner, { borderColor: colors.border }]}>
          <Text style={[styles.bannerText, { color: colors.muted }]}>
            Telegram 提醒当前为 dry_run：提醒会排进外发箱并记为 held，不会真的发出。
            需要真发时由管理员在服务端设置 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 并把
            SUPPORT_TELEGRAM_NOTIFY_MODE 设为 live（沿用现有 bot，不新建）。
            {notify.hasToken ? "" : " 当前未配置 token。"}
            {notify.hasChatId ? "" : " 当前未配置 chat id。"}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.banner, { borderColor: colors.border }]}>
          <Text style={[styles.bannerText, { color: colors.foreground }]}>{error}</Text>
        </View>
      ) : null}

      <AdminSection title="会话列表" meta={`共 ${total} 条`}>
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((item) => {
            const active = status === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setStatus(item.key)}
                style={[
                  styles.filterChip,
                  { borderColor: colors.border },
                  active && { backgroundColor: colors.foreground },
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? colors.background : colors.muted },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => void loadList()}
            style={[styles.filterChip, { borderColor: colors.border }]}
          >
            <Text style={[styles.filterText, { color: colors.muted }]}>刷新</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleDrain()}
            style={[styles.filterChip, { borderColor: colors.border }]}
          >
            <Text style={[styles.filterText, { color: colors.muted }]}>推送提醒外发箱</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" color={colors.foreground} style={styles.loading} />
        ) : items.length === 0 ? (
          <Text style={[styles.empty, { color: colors.muted }]}>暂无会话。</Text>
        ) : (
          <View style={styles.list}>
            {items.map((item) => {
              const active = selected === item.publicNo;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => void loadThread(item.publicNo)}
                  style={[
                    styles.card,
                    { borderColor: active ? colors.foreground : colors.border },
                  ]}
                >
                  <View style={styles.cardHead}>
                    <Text style={[styles.cardNo, { color: colors.foreground }]}>
                      {item.publicNo}
                    </Text>
                    <Text style={[styles.cardStatus, { color: colors.muted }]}>
                      {`${
                        item.status === "open"
                          ? "待回复"
                          : item.status === "answered"
                            ? "已回复"
                            : "已关闭"
                      } · ${item.operatorTakeover ? "人工接管中" : "自动接待中"}`}
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {item.strategyTitle ||
                      (item.strategyId ? `商品编号 ${item.strategyId}` : "未绑定商品")}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.muted }]}>
                    {`客户 ${item.customerMessageCount} 条 · 我方 ${item.operatorMessageCount} 条 · ${
                      item.identity === "member" ? "已登录客户" : "访客"
                    } · ${formatTime(item.lastMessageAt)}`}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.muted }]}>
                    {`提醒：${
                      item.notifyStatus ? NOTIFY_LABEL[item.notifyStatus] ?? item.notifyStatus : "无"
                    }${item.notifyAttempts ? ` · 尝试 ${item.notifyAttempts} 次` : ""}${
                      item.notifyError ? ` · ${item.notifyError}` : ""
                    }`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </AdminSection>

      <AdminSection
        title={selected ? `会话 ${selected}` : "会话内容"}
        meta={selected ? "客户能看到你在这里发的每一条" : "左侧选一条会话"}
      >
        {!selected ? (
          <Text style={[styles.empty, { color: colors.muted }]}>
            选一条会话查看完整往来记录。
          </Text>
        ) : isThreadLoading ? (
          <ActivityIndicator size="small" color={colors.foreground} style={styles.loading} />
        ) : (
          <>
            <ScrollView style={styles.thread} contentContainerStyle={styles.threadContent}>
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[styles.message, { borderColor: colors.border }]}
                >
                  <Text style={[styles.messageRole, { color: colors.muted }]}>
                    {`${ROLE_LABEL[message.role]}${
                      message.autoRuleKey ? ` · 规则 ${message.autoRuleKey}` : ""
                    } · ${formatTime(message.createdAt)}`}
                  </Text>
                  <Text style={[styles.messageBody, { color: colors.foreground }]} selectable>
                    {message.body}
                  </Text>
                </View>
              ))}
            </ScrollView>

            <Text style={[styles.assistNote, { color: colors.muted, borderColor: colors.border }]}>
              {threadTakeover
                ? "人工接管中：自动接待已停。客户之后发的每一条都只会留在这里等你回，机器人不会再答。"
                : "自动接待中：客户发消息时机器人会先答一句。你在这里发出第一条回复后自动转人工接管。"}
            </Text>

            <TextInput
              value={draft}
              onChangeText={(value) => setDraft(value.slice(0, SUPPORT_MESSAGE_MAX_LENGTH))}
              placeholder="以站点运营身份回复；客户会在网页会话里看到。不要自称某位具体的顾问本人。"
              placeholderTextColor={colors.muted}
              multiline
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.foreground },
              ]}
            />
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => void handleReply()}
                disabled={!draft.trim() || isSending}
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.foreground },
                  (!draft.trim() || isSending) && styles.disabled,
                ]}
              >
                <Text style={[styles.primaryText, { color: colors.background }]}>
                  {isSending ? "发送中…" : "发送回复"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleAutoAssist(threadTakeover)}
                disabled={isTogglingAssist}
                style={[
                  styles.ghostButton,
                  { borderColor: colors.border },
                  isTogglingAssist && styles.disabled,
                ]}
              >
                <Text style={[styles.ghostText, { color: colors.muted }]}>
                  {threadTakeover ? "交还自动接待" : "人工接管（停自动接待）"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleStatus("closed")}
                style={[styles.ghostButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.ghostText, { color: colors.muted }]}>标记已关闭</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleStatus("open")}
                style={[styles.ghostButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.ghostText, { color: colors.muted }]}>重开</Text>
              </Pressable>
            </View>
          </>
        )}
      </AdminSection>
    </AdminPageChrome>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  bannerText: { fontSize: 12, lineHeight: 19 },
  assistNote: {
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
    fontSize: 12,
    lineHeight: 19,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 999,
  },
  filterText: { fontSize: 12, fontWeight: "700" },
  loading: { marginVertical: 16 },
  empty: { fontSize: 13, paddingVertical: 12 },
  list: { gap: 10 },
  card: { padding: 12, borderWidth: 1, borderRadius: 8, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardNo: { fontSize: 13, fontWeight: "800" },
  cardStatus: { fontSize: 11, fontWeight: "700" },
  cardTitle: { fontSize: 13, fontWeight: "600" },
  cardMeta: { fontSize: 11, lineHeight: 17 },
  thread: { maxHeight: Platform.OS === "web" ? 420 : 340 },
  threadContent: { gap: 10, paddingBottom: 8 },
  message: { padding: 10, borderWidth: 1, borderRadius: 8, gap: 4 },
  messageRole: { fontSize: 11, fontWeight: "700" },
  messageBody: { fontSize: 13, lineHeight: 20 },
  input: {
    marginTop: 12,
    minHeight: 90,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 13,
    textAlignVertical: "top",
  },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
  primaryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  primaryText: { fontSize: 13, fontWeight: "800" },
  ghostButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  ghostText: { fontSize: 12, fontWeight: "700" },
  disabled: { opacity: 0.45 },
});
