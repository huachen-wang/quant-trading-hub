import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform, Modal, Pressable, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/constants/oauth";
import * as SecureStore from "expo-secure-store";

async function getAdminToken(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem("admin_token");
  return await SecureStore.getItemAsync("admin_token");
}

async function adminFetch(path: string, method: string = "GET", body?: any) {
  const token = await getAdminToken();
  const baseUrl = getApiBaseUrl();
  if (method === "GET") {
    const encoded = body ? encodeURIComponent(JSON.stringify({ json: body })) : encodeURIComponent(JSON.stringify({ json: {} }));
    const res = await fetch(`${baseUrl}/api/trpc/${path}?input=${encoded}`, {
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const data = await res.json();
    return data.result?.data?.json;
  } else {
    const res = await fetch(`${baseUrl}/api/trpc/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ json: body }),
    });
    const data = await res.json();
    return data.result?.data?.json;
  }
}

type Tab = "cards" | "plans";

export default function CooperationManage() {
  const colors = useColors();
  const [tab, setTab] = useState<Tab>("cards");
  const [cards, setCards] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        adminFetch("cooperationAdmin.cards.list"),
        adminFetch("cooperationAdmin.plans.list"),
      ]);
      setCards(c || []);
      setPlans(p || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditItem(null);
    if (tab === "cards") {
      setForm({ title: "", subtitle: "", description: "", coverImage: "", galleryImages: "", badge: "", badgeColor: "gold", strategyType: "", platform: "MT5", observeNote: "", contactInfo: "", sortOrder: 0, isVisible: true });
    } else {
      setForm({ title: "", badge: "", price: "", priceNote: "", features: "[]", sortOrder: 0, isVisible: true });
    }
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ ...item });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (tab === "cards") {
        const data = { ...form, sortOrder: Number(form.sortOrder) || 0 };
        if (editItem) {
          await adminFetch("cooperationAdmin.cards.update", "POST", data);
        } else {
          await adminFetch("cooperationAdmin.cards.create", "POST", data);
        }
      } else {
        const data = { ...form, sortOrder: Number(form.sortOrder) || 0 };
        if (editItem) {
          await adminFetch("cooperationAdmin.plans.update", "POST", data);
        } else {
          await adminFetch("cooperationAdmin.plans.create", "POST", data);
        }
      }
      setShowForm(false);
      loadData();
    } catch (e: any) {
      if (Platform.OS === "web") alert("保存失败: " + e.message);
      else Alert.alert("错误", "保存失败: " + e.message);
    }
  };

  const handleDelete = async (id: number) => {
    const doDelete = async () => {
      try {
        if (tab === "cards") await adminFetch("cooperationAdmin.cards.delete", "POST", { id });
        else await adminFetch("cooperationAdmin.plans.delete", "POST", { id });
        loadData();
      } catch (e: any) {
        if (Platform.OS === "web") alert("删除失败");
        else Alert.alert("错误", "删除失败");
      }
    };
    if (Platform.OS === "web") { if (confirm("确认删除？")) doDelete(); }
    else Alert.alert("确认", "确认删除？", [{ text: "取消" }, { text: "删除", style: "destructive", onPress: doDelete }]);
  };

  if (loading) {
    return <ScreenContainer className="items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>🤝 合作方案管理</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>管理面向工作室/客户的合作展示卡片和合作模式</Text>

        {/* Tab 切换 */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {(["cards", "plans"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
                backgroundColor: tab === t ? colors.primary : colors.surface,
              }}
            >
              <Text style={{ color: tab === t ? "#fff" : colors.foreground, fontWeight: "700" }}>
                {t === "cards" ? "策略卡片" : "合作模式"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 新增按钮 */}
        <TouchableOpacity onPress={openCreate} style={{ backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginBottom: 16 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>+ 新增{tab === "cards" ? "策略卡片" : "合作模式"}</Text>
        </TouchableOpacity>

        {/* 列表 */}
        {tab === "cards" && cards.map((card) => (
          <View key={card.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{card.title}</Text>
                {card.subtitle && <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{card.subtitle}</Text>}
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  {card.badge && <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}><Text style={{ fontSize: 10, color: "#A8895A" }}>{card.badge}</Text></View>}
                  {card.platform && <View style={{ backgroundColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}><Text style={{ fontSize: 10, color: colors.muted }}>{card.platform}</Text></View>}
                  <Text style={{ fontSize: 10, color: card.isVisible ? colors.success : colors.error }}>{card.isVisible ? "可见" : "隐藏"}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => openEdit(card)} style={{ backgroundColor: colors.primary + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(card.id)} style={{ backgroundColor: colors.error + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                  <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {tab === "plans" && plans.map((plan) => (
          <View key={plan.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{plan.title}</Text>
                {plan.price && <Text style={{ fontSize: 14, color: colors.primary, fontWeight: "600", marginTop: 2 }}>{plan.price}</Text>}
                {plan.badge && <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start", marginTop: 4 }}><Text style={{ fontSize: 10, color: "#A8895A" }}>{plan.badge}</Text></View>}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => openEdit(plan)} style={{ backgroundColor: colors.primary + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(plan.id)} style={{ backgroundColor: colors.error + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                  <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {((tab === "cards" && cards.length === 0) || (tab === "plans" && plans.length === 0)) && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>暂无数据，点击上方按钮新增</Text>
          </View>
        )}
      </ScrollView>

      {/* 编辑弹窗 */}
      <Modal visible={showForm} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 }} onPress={() => setShowForm(false)}>
          <Pressable style={{ backgroundColor: colors.background, borderRadius: 16, padding: 20, maxHeight: "85%" }} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>
                {editItem ? "编辑" : "新增"}{tab === "cards" ? "策略卡片" : "合作模式"}
              </Text>

              {tab === "cards" ? (
                <>
                  {renderField("标题 *", "title")}
                  {renderField("副标题", "subtitle")}
                  {renderField("描述", "description", true)}
                  {renderField("封面图URL", "coverImage")}
                  {renderField("画廊图片 (JSON数组)", "galleryImages", true)}
                  {renderField("标签文字", "badge")}
                  {renderField("标签颜色 (gold/red/green/blue)", "badgeColor")}
                  {renderField("策略类型 (如: 马丁/对冲/趋势)", "strategyType")}
                  {renderField("平台 (MT4/MT5)", "platform")}
                  {renderField("观摩说明", "observeNote", true)}
                  {renderField("联系方式", "contactInfo")}
                  {renderField("排序 (数字越小越前)", "sortOrder")}
                  {renderToggle("是否可见", "isVisible")}
                </>
              ) : (
                <>
                  {renderField("标题 *", "title")}
                  {renderField("标签 (如: 推荐/热门)", "badge")}
                  {renderField("价格 (如: ¥2999/月)", "price")}
                  {renderField("价格说明", "priceNote")}
                  {renderField("功能列表 (JSON数组)", "features", true)}
                  {renderField("排序 (数字越小越前)", "sortOrder")}
                  {renderToggle("是否可见", "isVisible")}
                </>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
                <TouchableOpacity onPress={() => setShowForm(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center" }}>
                  <Text style={{ color: colors.foreground, fontWeight: "600" }}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center" }}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>保存</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );

  function renderField(label: string, key: string, multiline?: boolean) {
    return (
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>{label}</Text>
        <TextInput
          value={String(form[key] ?? "")}
          onChangeText={(v) => setForm({ ...form, [key]: v })}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          style={{
            backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
            color: colors.foreground, fontSize: 14, borderWidth: 1, borderColor: colors.border,
            ...(multiline ? { minHeight: 80, textAlignVertical: "top" } : {}),
          }}
          placeholderTextColor={colors.muted}
        />
      </View>
    );
  }

  function renderToggle(label: string, key: string) {
    return (
      <TouchableOpacity
        onPress={() => setForm({ ...form, [key]: !form[key] })}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingVertical: 8 }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>{label}</Text>
        <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: form[key] ? colors.success : colors.border, justifyContent: "center", paddingHorizontal: 2 }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", alignSelf: form[key] ? "flex-end" : "flex-start" }} />
        </View>
      </TouchableOpacity>
    );
  }
}
