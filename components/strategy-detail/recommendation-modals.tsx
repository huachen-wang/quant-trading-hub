import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AppColors } from "./types";

type RecommendationModalProps = {
  visible: boolean;
  colors: AppColors;
  onClose: () => void;
};

export function BrokerRecommendationModal({ visible, colors, onClose }: RecommendationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: 420 }]}
        >
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Blueberry Markets</Text>
          <Text style={[styles.modalSubtitle, { color: colors.muted, marginBottom: 16 }]}>澳洲 ASIC 全牌照监管 · 官方合作经纪商</Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 10 }}>平台核心优势</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                { icon: "SAFE", title: "资金安全", desc: "不碰客户本金，审计严格" },
                { icon: "ASIC", title: "ASIC全牌照", desc: "澳洲政府颁发MM牌照" },
                { icon: "FLOW", title: "大资金出入", desc: "月交易量2500亿美金+" },
                { icon: "FAST", title: "极速出金", desc: "2-5小时到账" },
              ].map((item) => (
                <View key={item.title} style={{ width: "48%", backgroundColor: colors.background, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: "#D8BC83", fontSize: 10, fontWeight: "900", marginBottom: 4 }}>{item.icon}</Text>
                  <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 2 }}>{item.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 }}>账户与交易成本</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 22 }}>{"标准账户：点差约29，最高返佣20\n直接账户（ECN）：点差约7\n支持美金账户 & 美分账户\n最低入金：50U"}</Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 }}>监管与资质</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 22 }}>{"澳洲ASIC MM全牌照（政府颁发）\n2019-2025年仅5-6家获得此牌照\n牌照市场价值约600万美金\n盈利正常出金，从不拖延"}</Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 }}>开户咨询</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 22 }}>{"微信1号：oooiniooo0624\n微信2号：xau6000\nQQ1号：1226426670\nQQ2号：3832001817\nTelegram：@xau6000\n\n添加客服即可获取专属开户链接与返佣方案"}</Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
            activeOpacity={0.8}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>我知道了</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function VpsRecommendationModal({ visible, colors, onClose }: RecommendationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={styles.modalOverlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.modalContent, { backgroundColor: colors.background, maxWidth: 400 }]}
        >
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>VPS 服务器推荐</Text>
          <Text style={[styles.modalSubtitle, { color: colors.muted, marginBottom: 16 }]}>EA 全天候稳定运行的必备基础设施</Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 }}>为什么需要 VPS？</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>EA 需要 7×24 小时不间断运行，家用电脑无法保证稳定性。专业外汇 VPS 提供低延迟、高可用的服务器环境，确保您的 EA 策略不错过任何交易机会。</Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 }}>免费 VPS 申请</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>通过我们的合作经纪商开户并达到一定交易量，即可申请免费 VPS 服务。详情请联系客服咨询。</Text>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 }}>联系方式</Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 22 }}>微信1号：oooiniooo0624{"\n"}微信2号：xau6000{"\n"}QQ1号：1226426670{"\n"}QQ2号：3832001817{"\n"}Telegram：@xau6000{"\n"}添加客服咨询可靠 VPS 推荐及免费申请方案</Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
            activeOpacity={0.8}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>我知道了</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
});
