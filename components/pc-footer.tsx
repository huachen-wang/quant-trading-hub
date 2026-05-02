import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { Link } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { useResponsive } from "@/hooks/use-responsive";

/**
 * PC 端全局 Footer
 *
 * 仅在 Platform.OS === 'web' 且 isDesktop 时渲染。
 * 移动端不显示（移动端依赖底部 tabbar 导航）。
 *
 * 包含：
 *   - 顶部：项目矩阵 pill 横排
 *   - 中部：5 列链接（关于 / 产品 / 帮助 / 商务 / 条款）
 *   - 底部：版权 + 备案号
 */
export function PcFooter() {
  const colors = useColors();
  const { isDesktop } = useResponsive();

  if (Platform.OS !== "web" || !isDesktop) return null;

  return (
    <View style={styles.footer}>
      <View style={styles.inner}>
        {/* 项目矩阵 */}
        <View style={styles.sites}>
          <Text style={styles.sitesLabel}>EAXAU 项目矩阵</Text>
          <Pressable style={[styles.sitePill, styles.sitePillActive]}>
            <Text style={[styles.sitePillText, { color: "#FBBF24" }]}>
              EA 军火库 · eaxau.com
            </Text>
          </Pressable>
          <Pressable style={styles.sitePill}>
            <Text style={[styles.sitePillText, { color: colors.muted }]}>
              EA 破解网 · 即将上线
            </Text>
          </Pressable>
          <Pressable
            style={styles.sitePill}
            onPress={() => Platform.OS === "web" && window.open("https://ddxau.com", "_blank")}
          >
            <Text style={[styles.sitePillText, { color: colors.muted }]}>
              点金 · ddxau.com
            </Text>
          </Pressable>
          <Pressable
            style={styles.sitePill}
            onPress={() => Platform.OS === "web" && window.open("https://eaea.ai", "_blank")}
          >
            <Text style={[styles.sitePillText, { color: colors.muted }]}>
              量化风云榜 · eaea.ai
            </Text>
          </Pressable>
        </View>

        {/* 5 列链接 */}
        <View style={styles.grid}>
          <View style={styles.col}>
            <Text style={styles.colHeading}>关于 EAXAU</Text>
            <Text style={[styles.aboutText, { color: colors.muted }]}>
              专业的 MT4/MT5 EA 策略展示与量化交易合作平台。源头直供 · 实盘可查 · 透明定价。
              让每一笔交易都建立在真实数据之上。
            </Text>
          </View>

          <View style={styles.col}>
            <Text style={styles.colHeading}>产品</Text>
            <FooterLink href="/(tabs)" label="策略广场" />
            <FooterLink href="/(tabs)/moments" label="合作授权" />
            <FooterLink href="/(tabs)/group-buy" label="合购拼团" />
            <FooterLink href="/promo" label="限时促销" />
            <FooterLink href="/cooperation" label="工作室扶持" />
          </View>

          <View style={styles.col}>
            <Text style={styles.colHeading}>帮助</Text>
            <FooterLink href="/" label="MT4 教程" />
            <FooterLink href="/" label="MT5 教程" />
            <FooterLink href="/" label="VPS 推荐" />
            <FooterLink href="/" label="经纪商对比" />
            <FooterLink href="/" label="常见问题" />
          </View>

          <View style={styles.col}>
            <Text style={styles.colHeading}>商务</Text>
            <FooterLink href="/cooperation" label="上架 EA" />
            <FooterLink href="/cooperation" label="工作室合作" />
            <FooterLink href="/cooperation" label="渠道分销" />
            <FooterLink href="/cooperation" label="媒体合作" />
            <FooterLink href="/cooperation" label="联系我们" />
          </View>

          <View style={styles.col}>
            <Text style={styles.colHeading}>条款</Text>
            <FooterLink href="/" label="服务条款" />
            <FooterLink href="/" label="隐私政策" />
            <FooterLink href="/" label="免责声明" />
            <FooterLink href="/" label="退款政策" />
            <FooterLink href="/" label="版权声明" />
          </View>
        </View>

        {/* 底部版权 */}
        <View style={styles.bottom}>
          <Text style={[styles.copy, { color: colors.muted }]}>
            © 2026 EAXAU · 量化军火库. All rights reserved.
          </Text>
          <Text style={[styles.copy, { color: colors.muted }]}>
            沪 ICP 备 XXXXXXXX 号 · 沪公网安备 XXXXXXXX 号
          </Text>
        </View>
      </View>
    </View>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as any} asChild>
      <Pressable style={styles.linkItem}>
        <Text style={styles.linkText}>{label}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 60,
    paddingVertical: 56,
    paddingHorizontal: 32,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.12)",
    backgroundColor: "rgba(5,8,16,0.4)",
  },
  inner: { maxWidth: 1400, width: "100%", alignSelf: "center" },
  // Sites row
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
  // Grid
  grid: {
    flexDirection: "row",
    gap: 40,
    marginBottom: 36,
    flexWrap: "wrap",
  },
  col: { flex: 1, minWidth: 160 },
  colHeading: {
    color: "#F1F5F9",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.96,
    marginBottom: 16,
    textTransform: "uppercase",
  },
  aboutText: { fontSize: 13, lineHeight: 22 },
  linkItem: { paddingVertical: 5 },
  linkText: { color: "#94A3B8", fontSize: 13 },
  // Bottom
  bottom: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.08)",
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
  },
  copy: { fontSize: 12 },
});
