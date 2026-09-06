import { useState, useEffect, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { AdminPageChrome, AdminSection } from "@/components/admin/page-chrome";
import { useColors } from "@/hooks/use-colors";
import { getSubscribers, adminQuery } from "@/lib/admin-api";

type Subscriber = {
  id: number;
  email: string | null;
  contactInfo?: string | null;
  contactType?: string | null;
  interestContext?: string | null;
  sourcePath?: string | null;
  isActive: boolean;
  createdAt: Date | string;
};

const CONTACT_TYPE_LABELS: Record<string, string> = {
  wechat: "微信",
  qq: "QQ",
  telegram: "TG",
  email: "邮箱",
  unknown: "未知",
};

export default function SubscribersAdmin() {
  const colors = useColors();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [subs, cnt] = await Promise.all([getSubscribers({ limit: 100 }), adminQuery("subscriptions.count")]);
      setSubscribers(Array.isArray(subs) ? subs : []);
      setCount(typeof cnt === "number" ? cnt : null);
    } catch (err) { console.error(err); setSubscribers([]); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const formatDate = (dateStr: string | Date) => {
    try {
      const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch { return String(dateStr); }
  };

  const getDisplayContact = (item: Subscriber) => {
    const parts: string[] = [];
    if (item.contactInfo) {
      const typeLabel = CONTACT_TYPE_LABELS[item.contactType || "unknown"] || "联系方式";
      parts.push(`[${typeLabel}] ${item.contactInfo}`);
    }
    if (item.email) {
      parts.push(item.email);
    }
    return parts.join(" | ") || "无联系方式";
  };

  const renderItem = ({ item, index }: { item: Subscriber; index: number }) => (
    <View style={[st.row, { backgroundColor: index % 2 === 0 ? colors.surface : "rgba(15,23,42,0.54)", borderBottomColor: colors.border }]}>
      <Text style={[st.indexCell, { color: colors.muted }]}>{index + 1}</Text>
      <View style={st.contactCell}>
        <Text style={[st.contactText, { color: colors.foreground }]} numberOfLines={1}>
          {getDisplayContact(item)}
        </Text>
        {item.interestContext ? (
          <Text style={[st.contextText, { color: colors.muted }]} numberOfLines={1}>
            {item.interestContext}{item.sourcePath ? ` · ${item.sourcePath}` : ""}
          </Text>
        ) : null}
      </View>
      <View style={[st.statusBadge, { backgroundColor: item.isActive ? colors.success + "20" : colors.error + "20" }]}>
        <Text style={{ color: item.isActive ? colors.success : colors.error, fontSize: 12, fontWeight: "600" }}>{item.isActive ? "活跃" : "已取消"}</Text>
      </View>
      <Text style={[st.dateCell, { color: colors.muted }]}>{formatDate(item.createdAt)}</Text>
    </View>
  );

  return (
    <AdminPageChrome
      eyebrow="SUBSCRIBER LEDGER"
      title="订阅用户列表"
      subtitle="查看邮箱、社媒联系方式和订阅状态"
      metrics={[
        { label: "当前加载", value: subscribers.length, tone: colors.primary },
        { label: "活跃订阅", value: count ?? "...", tone: colors.success },
        { label: "已取消", value: subscribers.filter((item) => !item.isActive).length, tone: colors.error },
      ]}
      maxWidth={1180}
    >
      <AdminSection title="用户记录" meta="CONTACTS">
        {isLoading ? (
          <View style={st.loadingBox}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : subscribers.length === 0 ? (
          <Text style={[st.emptyText, { color: colors.muted }]}>暂无订阅用户</Text>
        ) : (
          <View style={[st.tablePanel, { borderColor: colors.border }]}>
            <View style={[st.tableHead, { borderBottomColor: colors.border }]}>
              <Text style={[st.indexCell, st.headText, { color: colors.muted }]}>#</Text>
              <Text style={[st.contactCell, st.headText, { color: colors.muted }]}>联系方式</Text>
              <Text style={[st.statusHead, st.headText, { color: colors.muted }]}>状态</Text>
              <Text style={[st.dateCell, st.headText, { color: colors.muted }]}>创建时间</Text>
            </View>
            {subscribers.map((item, index) => renderItem({ item, index }))}
          </View>
        )}
      </AdminSection>
    </AdminPageChrome>
  );
}

const st = StyleSheet.create({
  loadingBox: { minHeight: 220, alignItems: "center", justifyContent: "center" },
  tablePanel: { borderWidth: 1, borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(15,23,42,0.56)" },
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 8, backgroundColor: "rgba(2,6,23,0.36)" },
  headText: { fontSize: 10, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1, gap: 8 },
  indexCell: { width: 30, fontSize: 13, textAlign: "center" },
  contactCell: { flex: 1 },
  contactText: { fontSize: 14 },
  contextText: { fontSize: 11, marginTop: 4 },
  statusHead: { width: 70, textAlign: "center" },
  statusBadge: { width: 70, alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  dateCell: { width: 120, fontSize: 12, textAlign: "right" },
  emptyText: { textAlign: "center", marginTop: 40, fontSize: 14 },
});
