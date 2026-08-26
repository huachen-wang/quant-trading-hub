import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { V2 } from "@/components/v2/tokens";
import { useLanguage } from "@/lib/language";
import { shortWalletAddress, walletNetworkLabel } from "./wallet-client";
import { useInjectedWallet } from "./use-injected-wallet";

export function WalletConnect({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const wallet = useInjectedWallet();
  const { text } = useLanguage();
  const shortAddress = wallet.address
    ? shortWalletAddress(wallet.address)
    : compact
      ? ""
      : text("连接钱包", "Connect wallet", "ربط المحفظة");
  const triggerLabel = wallet.address
    ? shortWalletAddress(wallet.address)
    : text("连接 Web3 钱包", "Connect Web3 wallet", "ربط محفظة Web3");

  const copyAddress = async () => {
    if (!wallet.address) return;
    try {
      await globalThis.navigator?.clipboard?.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          wallet.address
            ? text(
                `已连接钱包 ${triggerLabel}`,
                `Connected wallet ${triggerLabel}`,
                `المحفظة المتصلة ${triggerLabel}`,
              )
            : text("连接 Web3 钱包", "Connect Web3 wallet", "ربط محفظة Web3")
        }
        onPress={() => {
          wallet.refreshProvider();
          setVisible(true);
        }}
        style={({ pressed }) => [
          styles.trigger,
          compact && styles.triggerCompact,
          wallet.connected && styles.triggerConnected,
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons
          name={wallet.connected ? "account-balance-wallet" : "link"}
          size={17}
          color={wallet.connected ? V2.green : V2.background}
        />
        {shortAddress ? (
          <Text
            style={[
              styles.triggerText,
              wallet.connected && styles.triggerTextConnected,
            ]}
          >
            {shortAddress}
          </Text>
        ) : null}
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            accessibilityLabel={text(
              "关闭钱包窗口",
              "Close wallet window",
              "إغلاق نافذة المحفظة",
            )}
            onPress={() => setVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.panel}>
            <View style={styles.heading}>
              <View>
                <Text style={styles.eyebrow}>
                  {text("链上身份", "ONCHAIN IDENTITY", "الهوية على السلسلة")}
                </Text>
                <Text style={styles.title}>
                  {text("连接钱包", "Connect wallet", "ربط المحفظة")}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text("关闭", "Close", "إغلاق")}
                onPress={() => setVisible(false)}
                style={styles.iconButton}
              >
                <MaterialIcons name="close" size={20} color={V2.textMuted} />
              </Pressable>
            </View>

            {wallet.connected && wallet.address ? (
              <>
                <View style={styles.connectionState}>
                  <View style={styles.connectedDot} />
                  <View style={styles.connectionCopy}>
                    <Text style={styles.connectionLabel}>
                      {text("钱包已连接", "Wallet connected", "المحفظة متصلة")}
                    </Text>
                    <Text style={styles.networkLabel}>
                      {walletNetworkLabel(
                        wallet.chainId,
                        text(
                          "网络待确认",
                          "Network pending",
                          "الشبكة قيد التأكيد",
                        ),
                      )}
                    </Text>
                  </View>
                </View>

                <View style={styles.addressRow}>
                  <View style={styles.addressCopy}>
                    <Text style={styles.addressLabel}>
                      {text("公开地址", "Public address", "العنوان العام")}
                    </Text>
                    <Text style={styles.address} numberOfLines={1}>
                      {wallet.address}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={text(
                      "复制钱包地址",
                      "Copy wallet address",
                      "نسخ عنوان المحفظة",
                    )}
                    onPress={copyAddress}
                    style={styles.copyButton}
                  >
                    <MaterialIcons
                      name={copied ? "check" : "content-copy"}
                      size={17}
                      color={copied ? V2.green : V2.text}
                    />
                  </Pressable>
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    wallet.disconnect();
                    setVisible(false);
                  }}
                  style={styles.disconnectButton}
                >
                  <Text style={styles.disconnectText}>
                    {text(
                      "断开本次连接",
                      "Disconnect this session",
                      "قطع اتصال هذه الجلسة",
                    )}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.walletOption}>
                  <View style={styles.walletIcon}>
                    <MaterialIcons
                      name="account-balance-wallet"
                      size={24}
                      color={V2.gold}
                    />
                  </View>
                  <View style={styles.walletOptionCopy}>
                    <Text style={styles.walletName}>
                      {text("浏览器钱包", "Browser wallet", "محفظة المتصفح")}
                    </Text>
                    <Text style={styles.walletStatus}>
                      {wallet.available
                        ? text(
                            "已检测到钱包，可直接授权连接",
                            "Wallet detected and ready to authorize",
                            "تم اكتشاف المحفظة وهي جاهزة للتفويض",
                          )
                        : text(
                            "支持 MetaMask、OKX Wallet、TokenPocket 等注入式钱包",
                            "Supports injected wallets such as MetaMask, OKX Wallet and TokenPocket",
                            "يدعم محافظ المتصفح مثل MetaMask وOKX Wallet وTokenPocket",
                          )}
                    </Text>
                  </View>
                </View>

                {wallet.error ? (
                  <View style={styles.errorState}>
                    <MaterialIcons
                      name="error-outline"
                      size={17}
                      color={V2.amber}
                    />
                    <Text style={styles.errorText}>{wallet.error}</Text>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ busy: wallet.connecting }}
                  disabled={wallet.connecting}
                  onPress={async () => {
                    const connected = await wallet.connect();
                    if (connected) setCopied(false);
                  }}
                  style={({ pressed }) => [
                    styles.connectButton,
                    wallet.connecting && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons name="link" size={18} color={V2.background} />
                  <Text style={styles.connectText}>
                    {wallet.connecting
                      ? text(
                          "等待钱包确认",
                          "Waiting for wallet approval",
                          "بانتظار موافقة المحفظة",
                        )
                      : text(
                          "连接浏览器钱包",
                          "Connect browser wallet",
                          "ربط محفظة المتصفح",
                        )}
                  </Text>
                </Pressable>
              </>
            )}

            <View style={styles.securityNote}>
              <MaterialIcons name="shield" size={17} color={V2.blue} />
              <Text style={styles.securityText}>
                {text(
                  "无需注册、邮箱或密码。网站只读取公开地址，不会请求助记词或私钥。",
                  "No registration, email or password is required. The site reads the public address only and never requests a seed phrase or private key.",
                  "لا يلزم تسجيل أو بريد إلكتروني أو كلمة مرور. يقرأ الموقع العنوان العام فقط ولا يطلب العبارة السرية أو المفتاح الخاص.",
                )}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  triggerCompact: { width: 38, paddingHorizontal: 0 },
  triggerConnected: {
    borderWidth: 1,
    borderColor: "rgba(66,211,161,0.45)",
    backgroundColor: "rgba(66,211,161,0.07)",
  },
  triggerText: {
    color: V2.background,
    fontSize: 11,
    fontWeight: "900",
  },
  triggerTextConnected: { color: V2.green },
  overlay: {
    flex: 1,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2,5,10,0.82)",
  },
  panel: {
    width: "100%",
    maxWidth: 450,
    padding: 20,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 6,
    backgroundColor: V2.backgroundRaised,
    gap: 16,
  },
  heading: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: { color: V2.gold, fontSize: 9, fontWeight: "900" },
  title: { marginTop: 3, color: V2.text, fontSize: 24, fontWeight: "900" },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionState: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  connectedDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: V2.green,
  },
  connectionCopy: { flex: 1, gap: 2 },
  connectionLabel: { color: V2.text, fontSize: 12, fontWeight: "900" },
  networkLabel: { color: V2.textMuted, fontSize: 9 },
  addressRow: {
    minHeight: 64,
    padding: 11,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: V2.surfaceMuted,
  },
  addressCopy: { flex: 1, minWidth: 0, gap: 5 },
  addressLabel: { color: V2.textDim, fontSize: 8, fontWeight: "800" },
  address: { color: V2.text, fontSize: 11, fontWeight: "800" },
  copyButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: V2.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  disconnectButton: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: V2.borderStrong,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  disconnectText: { color: V2.textMuted, fontSize: 10, fontWeight: "800" },
  walletOption: {
    minHeight: 72,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletIcon: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.4)",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(216,188,131,0.06)",
  },
  walletOptionCopy: { flex: 1, gap: 4 },
  walletName: { color: V2.text, fontSize: 13, fontWeight: "900" },
  walletStatus: { color: V2.textMuted, fontSize: 10, lineHeight: 15 },
  errorState: {
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(231,183,95,0.34)",
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  errorText: { flex: 1, color: V2.amber, fontSize: 9, lineHeight: 14 },
  connectButton: {
    minHeight: 44,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  connectText: { color: V2.background, fontSize: 11, fontWeight: "900" },
  securityNote: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: V2.border,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  securityText: { flex: 1, color: V2.textMuted, fontSize: 9, lineHeight: 14 },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72 },
});
