import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getBacktestData, createBacktestDataBatch, deleteAllBacktestData, deleteBacktestDataById, adminQuery } from "@/lib/admin-api";

interface BacktestDataPoint {
  id: number;
  strategyId: number;
  date: string;
  equity: string;
  balance: string;
  profit: string;
  drawdown: string;
  tradesCount: number;
}

export default function BacktestDataScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{ strategyId: string }>();
  const strategyId = params.strategyId ? parseInt(params.strategyId) : undefined;

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<BacktestDataPoint[]>([]);
  const [strategyTitle, setStrategyTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 生成参数
  const [genDays, setGenDays] = useState("180");
  const [genBaseReturn, setGenBaseReturn] = useState("50");
  const [genVolatility, setGenVolatility] = useState("2");
  const [genInitialEquity, setGenInitialEquity] = useState("10000");

  const loadData = async () => {
    if (!strategyId) return;
    setIsLoading(true);
    try {
      const result = await getBacktestData(strategyId);
      setData(Array.isArray(result) ? result : []);

      // 加载策略标题
      const strategy = await adminQuery("admin.strategies.detail", { id: strategyId });
      if (strategy) setStrategyTitle(strategy.title || `策略 #${strategyId}`);
    } catch (err) {
      console.error("Failed to load backtest data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [strategyId]);

  const handleDeleteAll = async () => {
    if (!strategyId) return;
    const doDelete = async () => {
      setIsDeleting(true);
      try {
        await deleteAllBacktestData(strategyId);
        setData([]);
        const msg = "回测数据已全部删除";
        if (Platform.OS === "web") alert(msg); else Alert.alert("成功", msg);
      } catch (err: any) {
        const msg = err?.message || "删除失败";
        if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
      } finally {
        setIsDeleting(false);
      }
    };

    if (Platform.OS === "web") {
      if (confirm("确定要删除该策略的所有回测数据吗？此操作不可撤销。")) {
        await doDelete();
      }
    } else {
      Alert.alert("确认删除", "确定要删除该策略的所有回测数据吗？此操作不可撤销。", [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleDeleteOne = async (id: number) => {
    const doDelete = async () => {
      try {
        await deleteBacktestDataById(id);
        setData(prev => prev.filter(d => d.id !== id));
      } catch (err: any) {
        const msg = err?.message || "删除失败";
        if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
      }
    };

    if (Platform.OS === "web") {
      if (confirm("确定删除这条数据？")) await doDelete();
    } else {
      Alert.alert("确认", "确定删除这条数据？", [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleGenerate = async () => {
    if (!strategyId) return;
    setIsGenerating(true);
    try {
      const days = parseInt(genDays) || 180;
      const baseReturn = parseFloat(genBaseReturn) || 50;
      const volatility = parseFloat(genVolatility) || 2;
      const initialEquity = parseFloat(genInitialEquity) || 10000;

      // 在客户端生成回测数据
      const generatedData: any[] = [];
      let equity = initialEquity;
      let balance = initialEquity;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        const dailyReturn = (baseReturn / 365) + (Math.random() - 0.5) * volatility;
        const profit = equity * (dailyReturn / 100);

        equity += profit;
        balance += profit;

        const maxEquity = Math.max(...generatedData.map(d => parseFloat(d.equity)), equity);
        const drawdown = ((maxEquity - equity) / maxEquity) * 100;
        const tradesCount = Math.floor(Math.random() * 5);

        generatedData.push({
          date: date.toISOString().split("T")[0],
          equity: equity.toFixed(2),
          balance: balance.toFixed(2),
          profit: profit.toFixed(2),
          drawdown: drawdown.toFixed(2),
          tradesCount,
        });
      }

      // 先删除旧数据
      await deleteAllBacktestData(strategyId);

      // 分批上传（每批100条）
      const batchSize = 100;
      for (let i = 0; i < generatedData.length; i += batchSize) {
        const batch = generatedData.slice(i, i + batchSize);
        await createBacktestDataBatch(strategyId, batch);
      }

      const msg = `已生成 ${generatedData.length} 条回测数据`;
      if (Platform.OS === "web") alert(msg); else Alert.alert("成功", msg);

      // 重新加载
      await loadData();
    } catch (err: any) {
      const msg = err?.message || "生成失败";
      if (Platform.OS === "web") alert(msg); else Alert.alert("错误", msg);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!strategyId) {
    return (
      <ScreenContainer style={{ alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.muted, fontSize: 16 }}>缺少策略ID参数</Text>
      </ScreenContainer>
    );
  }

  const inputStyle = [s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, maxWidth: 700, alignSelf: "center" as any, width: "100%" as any }}>
        {/* 返回按钮 */}
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: colors.surface }]} activeOpacity={0.7}>
          <Text style={{ color: colors.foreground, fontSize: 18 }}>← 返回</Text>
        </TouchableOpacity>

        <Text style={[s.pageTitle, { color: colors.foreground }]}>📈 回测数据管理</Text>
        <Text style={[s.pageSubtitle, { color: colors.muted }]}>
          策略: {strategyTitle || `#${strategyId}`} · 当前 {data.length} 条数据
        </Text>

        {/* 生成回测数据 */}
        <View style={[s.section, { backgroundColor: colors.surface }]}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>生成回测数据</Text>
          <Text style={[s.sectionDesc, { color: colors.muted }]}>
            自动生成模拟回测数据（会替换现有数据）
          </Text>

          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.foreground }]}>天数</Text>
              <TextInput value={genDays} onChangeText={setGenDays} keyboardType="numeric" style={inputStyle} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.foreground }]}>年化收益率(%)</Text>
              <TextInput value={genBaseReturn} onChangeText={setGenBaseReturn} keyboardType="numeric" style={inputStyle} />
            </View>
          </View>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.foreground }]}>波动率</Text>
              <TextInput value={genVolatility} onChangeText={setGenVolatility} keyboardType="numeric" style={inputStyle} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { color: colors.foreground }]}>初始资金</Text>
              <TextInput value={genInitialEquity} onChangeText={setGenInitialEquity} keyboardType="numeric" style={inputStyle} />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleGenerate}
            disabled={isGenerating}
            style={[s.btn, { backgroundColor: colors.primary, opacity: isGenerating ? 0.7 : 1 }]}
            activeOpacity={0.8}
          >
            {isGenerating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnText}>生成回测数据</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 删除所有数据 */}
        {data.length > 0 && (
          <TouchableOpacity
            onPress={handleDeleteAll}
            disabled={isDeleting}
            style={[s.deleteAllBtn, { backgroundColor: colors.error + "12", borderColor: colors.error + "30" }]}
            activeOpacity={0.8}
          >
            {isDeleting ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <Text style={[s.deleteAllBtnText, { color: colors.error }]}>删除所有回测数据 ({data.length} 条)</Text>
            )}
          </TouchableOpacity>
        )}

        {/* 数据列表 */}
        {isLoading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : data.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 15 }}>暂无回测数据</Text>
          </View>
        ) : (
          <View style={[s.section, { backgroundColor: colors.surface }]}>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>数据列表（最近20条）</Text>
            {data.slice(-20).reverse().map((item) => (
              <View key={item.id} style={[s.dataRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.dataDate, { color: colors.foreground }]}>
                    {typeof item.date === "string" ? item.date.split("T")[0] : item.date}
                  </Text>
                  <Text style={[s.dataDetail, { color: colors.muted }]}>
                    权益: {item.equity} | 利润: {item.profit} | 回撤: {item.drawdown}%
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteOne(item.id)}
                  style={[s.deleteOneBtn, { backgroundColor: colors.error + "12" }]}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>删除</Text>
                </TouchableOpacity>
              </View>
            ))}
            {data.length > 20 && (
              <Text style={[{ color: colors.muted, fontSize: 12, textAlign: "center", paddingVertical: 8 }]}>
                仅显示最近20条，共 {data.length} 条数据
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  backBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignSelf: "flex-start", marginBottom: 16 },
  pageTitle: { fontSize: 22, fontWeight: "800", marginBottom: 6 },
  pageSubtitle: { fontSize: 14, marginBottom: 20 },
  section: { borderRadius: 14, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 4 },
  sectionDesc: { fontSize: 13, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", gap: 10 },
  btn: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  deleteAllBtn: { borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 16, borderWidth: 1 },
  deleteAllBtnText: { fontWeight: "700", fontSize: 14 },
  dataRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dataDate: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  dataDetail: { fontSize: 12 },
  deleteOneBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
});
