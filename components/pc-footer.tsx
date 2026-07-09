import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";

/**
 * PC 端 Footer - 极简安全版
 * 零外部依赖，绝对不会崩。
 */
export function PcFooter() {
  const router = useRouter();
  const [isDesktopWeb, setIsDesktopWeb] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    
    const updateSize = () => {
      try {
        const { width } = Dimensions.get("window");
        setIsDesktopWeb(width >= 1024);
      } catch {
        setIsDesktopWeb(false);
      }
    };
    
    updateSize();
    const sub = Dimensions.addEventListener("change", updateSize);
    return () => {
      try {
        sub?.remove();
      } catch {}
    };
  }, []);

  if (!isDesktopWeb) return null;

  const openExternalUrl = (url: string) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  return (
    <View style={styles.footer}>
      <View style={styles.inner}>
        {/* 项目矩阵 */}
        <View style={styles.sites}>
          <Text style={styles.sitesLabel}>EAXAU 项目矩阵</Text>
          <View style={[styles.sitePill, styles.sitePillActive]}>
            <Text style={[styles.sitePillText, { color: "#D8BC83" }]}>
              EAXAU · eaxau.com
            </Text>
          </View>
          <View style={styles.sitePill}>
            <Text style={[styles.sitePillText, { color: "#94A3B8" }]}>
              源码研究台 · 即将上线
            </Text>
          </View>
          <Pressable
            style={styles.sitePill}
            onPress={() => openExternalUrl("https://ddxau.com")}
          >
            <Text style={[styles.sitePillText, { color: "#94A3B8" }]}>
              点金 · ddxau.com
            </Text>
          </Pressable>
          <Pressable
            style={styles.sitePill}
            onPress={() => openExternalUrl("https://eaea.ai")}
          >
            <Text style={[styles.sitePillText, { color: "#94A3B8" }]}>
              量化风云榜 · eaea.ai
            </Text>
          </Pressable>
        </View>

        {/* 链接列 */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.colHeading}>关于 EAXAU</Text>
            <Text style={styles.aboutText}>
              专业的 MT4/MT5 EA 策略展示与量化交易合作平台。源头直供 · 实盘可查 · 透明定价。
            </Text>
          </View>

          <View style={styles.col}>
            <Text style={styles.colHeading}>产品</Text>
            <Pressable style={styles.linkItem} onPress={() => router.push("/(tabs)" as any)}>
              <Text style={styles.linkText}>策略广场</Text>
            </Pressable>
            <Pressable style={styles.linkItem} onPress={() => router.push("/cooperation" as any)}>
              <Text style={styles.linkText}>合作授权</Text>
            </Pressable>
            <Pressable style={styles.linkItem} onPress={() => router.push("/promo" as any)}>
              <Text style={styles.linkText}>限时促销</Text>
            </Pressable>
          </View>

          <View style={styles.col}>
            <Text style={styles.colHeading}>帮助</Text>
            <Pressable style={styles.linkItem}>
              <Text style={styles.linkText}>MT4 教程</Text>
            </Pressable>
            <Pressable style={styles.linkItem}>
              <Text style={styles.linkText}>MT5 教程</Text>
            </Pressable>
            <Pressable style={styles.linkItem}>
              <Text style={styles.linkText}>常见问题</Text>
            </Pressable>
          </View>

          <View style={styles.col}>
            <Text style={styles.colHeading}>商务</Text>
            <Pressable
              style={styles.linkItem}
              onPress={() => router.push("/cooperation" as any)}
            >
              <Text style={styles.linkText}>工作室合作</Text>
            </Pressable>
            <Pressable
              style={styles.linkItem}
              onPress={() => router.push("/cooperation" as any)}
            >
              <Text style={styles.linkText}>联系我们</Text>
            </Pressable>
          </View>

          <View style={styles.col}>
            <Text style={styles.colHeading}>条款</Text>
            <Pressable style={styles.linkItem}>
              <Text style={styles.linkText}>服务条款</Text>
            </Pressable>
            <Pressable style={styles.linkItem}>
              <Text style={styles.linkText}>隐私政策</Text>
            </Pressable>
          </View>
        </View>

        {/* 版权 */}
        <View style={styles.bottom}>
          <Text style={styles.copy}>© 2026 EAXAU · Quant Source Desk. All rights reserved.</Text>
          <Text style={styles.copy}>沪 ICP 备 XXXXXXXX 号</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 60,
    paddingVertical: 56,
    paddingHorizontal: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.12)",
    backgroundColor: "#0A0E1A",
  },
  inner: { maxWidth: 1400, width: "100%", alignSelf: "center" },
  sites: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingBottom: 32,
    marginBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.12)",
  },
  sitesLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.76,
    marginRight: 4,
  },
  sitePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  sitePillActive: {
    borderColor: "rgba(245,158,11,0.4)",
    backgroundColor: "rgba(245,158,11,0.08)",
  },
  sitePillText: { fontSize: 13, fontWeight: "700" },
  grid: { flexDirection: "row", gap: 40, marginBottom: 36, flexWrap: "wrap" },
  col: { flex: 1, minWidth: 160 },
  colHeading: {
    color: "#F1F5F9",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.96,
    marginBottom: 16,
    textTransform: "uppercase",
  },
  aboutText: { fontSize: 13, lineHeight: 22, color: "#94A3B8" },
  linkItem: { paddingVertical: 5 },
  linkText: { color: "#94A3B8", fontSize: 13 },
  bottom: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.08)",
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  copy: { fontSize: 12, color: "#94A3B8" },
});
