import { Linking, Modal, Text, TouchableOpacity, View, type GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import type { PromoStyles } from "@/components/promo/styles";
import type { PromoContactInfo } from "@/components/promo/types";

type PromoContactModalProps = {
  visible: boolean;
  contact: PromoContactInfo;
  styles: PromoStyles;
  onClose: () => void;
};

export function PromoContactModal({
  visible,
  contact,
  styles: s,
  onClose,
}: PromoContactModalProps) {
  const openTelegram = () => {
    Linking.openURL(`https://t.me/${contact.telegram.replace("@", "")}`);
  };

  const stopPropagation = (event: GestureResponderEvent) => {
    event.stopPropagation();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={s.contactModal} activeOpacity={1} onPress={stopPropagation}>
          <LinearGradient colors={["#1E293B", "#0A1628"]} style={s.contactModalInner}>
            <View style={s.contactHeader}>
              <View style={s.contactIconWrap}>
                <Ionicons name="cart" size={28} color="#A8895A" />
              </View>
              <Text style={s.contactTitle}>联系客服购买</Text>
              <Text style={s.contactDesc}>备注商品名称，客服确认库存后即时发货</Text>
            </View>

            <View style={s.contactMethods}>
              <View style={[s.contactMethod, { backgroundColor: "#07C160" }]}>
                <Ionicons name="logo-wechat" size={22} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={s.contactMethodLabel}>微信</Text>
                  <Text style={s.contactMethodValue}>{`1号: ${contact.wechat1}`}</Text>
                  <Text style={[s.contactMethodValue, { fontSize: 13, marginTop: 2 }]}>{`2号: ${contact.wechat2}`}</Text>
                </View>
              </View>

              <View style={[s.contactMethod, { backgroundColor: "#12B7F5" }]}>
                <Ionicons name="chatbox" size={22} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={s.contactMethodLabel}>QQ</Text>
                  <Text style={s.contactMethodValue}>{`1号: ${contact.qq1}`}</Text>
                  <Text style={[s.contactMethodValue, { fontSize: 13, marginTop: 2 }]}>{`2号: ${contact.qq2}`}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[s.contactMethod, { backgroundColor: "#0088cc" }]}
                onPress={openTelegram}
              >
                <Ionicons name="paper-plane" size={22} color="#fff" />
                <View>
                  <Text style={s.contactMethodLabel}>Telegram</Text>
                  <Text style={s.contactMethodValue}>{contact.telegram}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={s.payMethods}>
              <Text style={s.payMethodsTitle}>支持的支付方式</Text>
              <View style={s.payMethodsRow}>
                {["USDT", "支付宝", "微信", "银行卡"].map((method) => (
                  <View key={method} style={s.payMethodChip}>
                    <Text style={s.payMethodChipText}>{method}</Text>
                  </View>
                ))}
              </View>
            </View>

            <TouchableOpacity style={s.contactCloseBtn} onPress={onClose}>
              <Text style={s.contactCloseBtnText}>关闭</Text>
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
