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

const CATEGORIES = [
  { key: "ea", label: "EA策略" },
  { key: "indicator", label: "指标" },
  { key: "tool", label: "工具" },
  { key: "course", label: "教程" },
];

const STATUSES = [
  { key: "active", label: "活跃", color: "#10B981" },
  { key: "expired", label: "已过期", color: "#F59E0B" },
  { key: "soldout", label: "已售罄", color: "#EF4444" },
];

export default function PromoManage() {
  const colors = useColors();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch("promoAdmin.list");
      setProducts(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditItem(null);
    setForm({
      title: "", description: "", coverImage: "", galleryImages: "",
      platform: "MT5", category: "ea", originalPrice: "", promoPrice: "",
      promoLabel: "限时特惠", promoEndTime: "", detailContent: "",
      paymentInfo: "", contactInfo: "", stock: 10, sortOrder: 0,
      isVisible: true, status: "active",
    });
    setShowForm(true);
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setForm({ ...item, stock: item.stock ?? 10, soldCount: item.soldCount ?? 0 });
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        ...form,
        sortOrder: Number(form.sortOrder) || 0,
        stock: Number(form.stock) || 10,
        ...(editItem ? { soldCount: Number(form.soldCount) || 0 } : {}),
      };
      if (editItem) {
        await adminFetch("promoAdmin.update", "POST", data);
      } else {
        await adminFetch("promoAdmin.create", "POST", data);
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
        await adminFetch("promoAdmin.delete", "POST", { id });
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
        <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>💰 促销商城管理</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>管理限时促销商品、价格、库存和促销标签</Text>

        {/* 新增按钮 */}
        <TouchableOpacity onPress={openCreate} style={{ backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginBottom: 16 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>+ 新增促销商品</Text>
        </TouchableOpacity>

        {/* 商品列表 */}
        {products.map((product) => {
          const statusInfo = STATUSES.find(s => s.key === product.status) || STATUSES[0];
          const discount = product.originalPrice && product.promoPrice
            ? Math.round((1 - parseFloat(product.promoPrice) / parseFloat(product.originalPrice)) * 100)
            : 0;
          return (
            <View key={product.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{product.title}</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: colors.error }}>${product.promoPrice}</Text>
                    {product.originalPrice && (
                      <Text style={{ fontSize: 13, color: colors.muted, textDecorationLine: "line-through" }}>${product.originalPrice}</Text>
                    )}
                    {discount > 0 && (
                      <View style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: "#DC2626", fontWeight: "700" }}>-{discount}%</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <View style={{ backgroundColor: statusInfo.color + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 10, color: statusInfo.color, fontWeight: "600" }}>{statusInfo.label}</Text>
                    </View>
                    {product.category && (
                      <View style={{ backgroundColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: colors.muted }}>{CATEGORIES.find(c => c.key === product.category)?.label || product.category}</Text>
                      </View>
                    )}
                    {product.platform && (
                      <View style={{ backgroundColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: colors.muted }}>{product.platform}</Text>
                      </View>
                    )}
                    {product.promoLabel && (
                      <View style={{ backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: "#D97706" }}>{product.promoLabel}</Text>
                      </View>
                    )}
                    <Text style={{ fontSize: 10, color: colors.muted }}>库存: {(product.stock || 0) - (product.soldCount || 0)}/{product.stock || 0}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity onPress={() => openEdit(product)} style={{ backgroundColor: colors.primary + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>编辑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(product.id)} style={{ backgroundColor: colors.error + "20", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                    <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {products.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>暂无促销商品，点击上方按钮新增</Text>
          </View>
        )}
      </ScrollView>

      {/* 编辑弹窗 */}
      <Modal visible={showForm} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 16 }} onPress={() => setShowForm(false)}>
          <Pressable style={{ backgroundColor: colors.background, borderRadius: 16, padding: 20, maxHeight: "90%" }} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>
                {editItem ? "编辑" : "新增"}促销商品
              </Text>

              {renderField("商品名称 *", "title")}
              {renderField("描述", "description", true)}
              {renderField("封面图URL", "coverImage")}
              {renderField("截图画廊 (JSON数组)", "galleryImages", true)}

              {/* 平台选择 */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>平台</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {["MT4", "MT5"].map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setForm({ ...form, platform: p })}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: form.platform === p ? colors.primary : colors.surface }}
                    >
                      <Text style={{ color: form.platform === p ? "#fff" : colors.foreground, fontWeight: "600" }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 分类选择 */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>分类</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {CATEGORIES.map((c) => (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => setForm({ ...form, category: c.key })}
                      style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: form.category === c.key ? colors.primary : colors.surface }}
                    >
                      <Text style={{ color: form.category === c.key ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {renderField("原价 ($)", "originalPrice")}
              {renderField("促销价 ($) *", "promoPrice")}
              {renderField("促销标签 (如: 限时特惠)", "promoLabel")}
              {renderField("促销截止时间 (YYYY-MM-DD HH:mm)", "promoEndTime")}
              {renderField("产品详情", "detailContent", true)}
              {renderField("支付说明", "paymentInfo", true)}
              {renderField("联系方式", "contactInfo")}
              {renderField("库存数量", "stock")}
              {editItem && renderField("已售数量", "soldCount")}
              {renderField("排序 (数字越小越前)", "sortOrder")}

              {/* 状态选择 */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>状态</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {STATUSES.map((s) => (
                    <TouchableOpacity
                      key={s.key}
                      onPress={() => setForm({ ...form, status: s.key })}
                      style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center", backgroundColor: form.status === s.key ? s.color : colors.surface }}
                    >
                      <Text style={{ color: form.status === s.key ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {renderToggle("是否可见", "isVisible")}

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
