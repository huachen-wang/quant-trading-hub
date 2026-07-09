import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getBacktestData, createBacktestDataItem, deleteBacktestDataItem, deleteAllBacktestData } from "@/lib/admin-api";

export default function BacktestDataScreen() {
  const router = useRouter();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;
  const params = useLocalSearchParams<{ strategyId: string; title?: string }>();
  const strategyId = parseInt(params.strategyId || "0");
  const strategyTitle = params.title || `策略 #${strategyId}`;

  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [genDays, setGenDays] = useState("90");
  const [genReturn, setGenReturn] = useState("50");
  const [genVolatility, setGenVolatility] = useState("2");
  const [genInitial, setGenInitial] = useState("10000");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const result = await getBacktestData(strategyId);
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error("Failed to load backtest data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (strategyId) loadData();
  }, [strategyId]);

  const handleGenerate = async () => {
    const days = parseInt(genDays) || 90;
    const annualReturn = parseFloat(genReturn) || 50;
    const volatility = parseFloat(genVolatility) || 2;
    const initial = parseFloat(genInitial) || 10000;

    const msg = `将为该策略生成 ${days} 天的模拟回测数据，是否继续？`;
    const doGenerate = async () => {
      setIsSubmitting(true);
      try {
        const dailyReturn = annualReturn / 365 / 100;
        let equity = initial;
        let balance = initial;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        for (let i = 0; i < days; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split("T")[0];

          const randomReturn = (dailyReturn + (Math.random() - 0.5) * volatility / 100);
          const dailyProfit = equity * randomReturn;
          equity += dailyProfit;
          balance += dailyProfit * (0.8 + Math.random() * 0.4);
          const drawdown = Math.max(0, (initial - Math.min(equity, balance)) / initial * 100);
          const trades = Math.floor(Math.random() * 8);

          await createBacktestDataItem({
            strategyId,
            date: dateStr,
            equity: equity.toFixed(2),
            balance: balance.toFixed(2),
            profit: dailyProfit.toFixed(2),
            drawdown: drawdown.toFixed(2),
            tradesCount: trades,
          });
        }
        const successMsg = `成功生成 ${days} 条回测数据`;
        if (Platform.OS === "web") alert(successMsg);
        else Alert.alert("成功", successMsg);
        loadData();
      } catch (err: any) {
        const errMsg = err?.message || "生成失败";
        if (Platform.OS === "web") alert(errMsg);
        else Alert.alert("错误", errMsg);
      } finally {
        setIsSubmitting(false);
      }
    };

    if (Platform.OS === "web") {
      if (confirm(msg)) doGenerate();
    } else {
      Alert.alert("确认", msg, [
        { text: "取消", style: "cancel" },
        { text: "确定", onPress: doGenerate },
      ]);
    }
  };

  const handleDeleteAll = async () => {
    const msg = "确定要删除该策略的所有回测数据吗？此操作不可恢复。";
    const doDelete = async () => {
      try {
        await deleteAllBacktestData(strategyId);
        const successMsg = "已删除所有回测数据";
        if (Platform.OS === "web") alert(successMsg);
        else Alert.alert("成功", successMsg);
        loadData();
      } catch (err: any) {
        const errMsg = err?.message || "删除失败";
        if (Platform.OS === "web") alert(errMsg);
        else Alert.alert("错误", errMsg);
      }
    };

    if (Platform.OS === "web") {
      if (confirm(msg)) doDelete();
    } else {
      Alert.alert("确认", msg, [
        { text: "取消", style: "cancel" },
        { text: "删除", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleDeleteOne = async (id: number) => {
    try {
      await deleteBacktestDataItem(id);
      loadData();
    } catch (err: any) {
      const errMsg = err?.message || "删除失败";
      if (Platform.OS === "web") alert(errMsg);
      else Alert.alert("错误", errMsg);
    }
  };

  const inputStyle = [s.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[s.scrollContent, isDesktop && s.scrollContentDesktop]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.primary, fontSize: 15 }}>← 返回策略列表</Text>
        </TouchableOpacity>

        <View style={s.headerPanel}>
          <Text style={s.kicker}>BACKTEST DATA TERMINAL</Text>
          <Text style={[s.pageTitle, { color: colors.foreground }]}>回测数据管理</Text>
          <Text style={[s.subtitle, { color: colors.muted }]}>{strategyTitle}</Text>
        </View>

        <View style={[s.contentGrid, isDesktop && s.contentGridDesktop]}>
          {/* 生成模拟数据 */}
          <View style={[s.card, isDesktop && s.generatorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>生成模拟回测数据</Text>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.foreground }]}>天数</Text>
                <TextInput value={genDays} onChangeText={setGenDays} keyboardType="numeric" style={inputStyle} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.foreground }]}>年化收益(%)</Text>
                <TextInput value={genReturn} onChangeText={setGenReturn} keyboardType="numeric" style={inputStyle} />
              </View>
            </View>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.foreground }]}>波动率(%)</Text>
                <TextInput value={genVolatility} onChangeText={setGenVolatility} keyboardType="numeric" style={inputStyle} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.foreground }]}>初始资金</Text>
                <TextInput value={genInitial} onChangeText={setGenInitial} keyboardType="numeric" style={inputStyle} />
              </View>
            </View>
            <TouchableOpacity
              onPress={handleGenerate}
              disabled={isSubmitting}
              style={[s.btn, { backgroundColor: isSubmitting ? colors.muted : colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={s.btnText}>{isSubmitting ? "生成中..." : "生成数据"}</Text>
            </TouchableOpacity>
            <View style={s.auditBox}>
              <Text style={s.auditText}>模拟数据只用于页面曲线预览，不会替代真实实盘记录。</Text>
            </View>
          </View>

          {/* 数据列表 */}
          <View style={[s.card, isDesktop && s.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.cardHeader}>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>
              数据列表 ({data.length} 条)
            </Text>
            {data.length > 0 && (
              <TouchableOpacity
                onPress={handleDeleteAll}
                style={[s.smallBtn, { backgroundColor: colors.error + "15" }]}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.error, fontSize: 13, fontWeight: "600" }}>清空全部</Text>
              </TouchableOpacity>
            )}
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ padding: 20 }} />
          ) : data.length === 0 ? (
            <Text style={[s.emptyText, { color: colors.muted }]}>暂无回测数据</Text>
          ) : (
            data.slice(0, 20).map((item: any) => (
              <View key={item.id} style={[s.dataRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.dataDate, { color: colors.foreground }]}>{item.date}</Text>
                  <Text style={[s.dataMeta, { color: colors.muted }]}>
                    权益: {item.equity} | 盈亏: {item.profit} | 回撤: {item.drawdown}%
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteOne(item.id)} style={{ padding: 6 }}>
                  <Text style={{ color: colors.error, fontSize: 13 }}>删除</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          {data.length > 20 && (
            <Text style={[s.moreText, { color: colors.muted }]}>
              仅显示前20条，共 {data.length} 条数据
            </Text>
          )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  scrollContent: { padding: 16, paddingBottom: 32, maxWidth: 760, alignSelf: "center" as any, width: "100%" as any },
  scrollContentDesktop: { maxWidth: 1260, paddingHorizontal: 22, paddingTop: 18 },
  headerPanel: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.16)",
    borderRadius: 6,
    padding: 15,
    marginBottom: 12,
    backgroundColor: "rgba(9,15,28,0.82)",
  },
  kicker: { color: "#D8BC83", fontSize: 11, fontWeight: "900", marginBottom: 6 },
  pageTitle: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 16 },
  contentGrid: { gap: 10 },
  contentGridDesktop: { flexDirection: "row", alignItems: "flex-start" },
  generatorCard: { width: 410 },
  dataCard: { flex: 1 },
  card: { borderWidth: 1, borderRadius: 6, padding: 13, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", gap: 10 },
  btn: { paddingVertical: 11, borderRadius: 6, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  auditBox: { marginTop: 12, padding: 12, borderRadius: 6, backgroundColor: "rgba(216,188,131,0.08)" },
  auditText: { color: "rgba(226,232,240,0.72)", fontSize: 12, lineHeight: 18 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  dataRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5 },
  dataDate: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  dataMeta: { fontSize: 12 },
  emptyText: { textAlign: "center", paddingVertical: 20, fontSize: 14 },
  moreText: { textAlign: "center", paddingTop: 10, fontSize: 13 },
});
