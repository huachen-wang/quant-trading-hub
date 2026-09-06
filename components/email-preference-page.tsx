import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from "@/lib/language";

type Props = {
  mode: "confirm" | "unsubscribe";
  tokenValid: boolean;
  onSubmit: () => Promise<{ ok: boolean }>;
};

export function EmailPreferencePage({ mode, tokenValid, onSubmit }: Props) {
  const router = useRouter();
  const { text } = useLanguage();
  const [state, setState] = useState<"idle" | "working" | "success" | "error">(
    "idle",
  );
  const confirm = mode === "confirm";

  const submit = async () => {
    if (!tokenValid || state === "working") return;
    setState("working");
    try {
      const result = await onSubmit();
      setState(result.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  };

  const title =
    state === "success"
      ? confirm
        ? text("订阅已确认", "Subscription confirmed", "تم تأكيد الاشتراك")
        : text("已完成退订", "You are unsubscribed", "تم إلغاء الاشتراك")
      : confirm
        ? text(
            "确认 EAXAU 邮件订阅",
            "Confirm EAXAU subscription",
            "تأكيد اشتراك EAXAU",
          )
        : text(
            "退订 EAXAU 邮件",
            "Unsubscribe from EAXAU",
            "إلغاء اشتراك EAXAU",
          );

  const detail =
    state === "success"
      ? confirm
        ? text(
            "后续你会收到 EA 产品更新与教育内容，也可随时退订。",
            "You can now receive EA product updates and educational content, and unsubscribe at any time.",
            "يمكنك الآن تلقي تحديثات منتجات EA والمحتوى التعليمي وإلغاء الاشتراك في أي وقت.",
          )
        : text(
            "此邮箱将不再收到 EAXAU 推广邮件。",
            "This email will no longer receive EAXAU marketing messages.",
            "لن يتلقى هذا البريد رسائل تسويقية من EAXAU بعد الآن.",
          )
      : confirm
        ? text(
            "确认后才会生效，范围仅限 EAXAU 的 EA 产品更新与教育内容。",
            "It becomes active only after you confirm. The scope is limited to EAXAU EA product updates and educational content.",
            "لن يصبح نشطا إلا بعد التأكيد، ويقتصر على تحديثات منتجات EA والمحتوى التعليمي من EAXAU.",
          )
        : text(
            "确认后将停止 EAXAU 推广邮件，不影响购买、付款或账户安全通知。",
            "This stops EAXAU marketing messages. Purchase, payment and account security notices are unaffected.",
            "سيؤدي ذلك إلى إيقاف رسائل EAXAU التسويقية دون التأثير على إشعارات الشراء أو الدفع أو أمان الحساب.",
          );

  const invalid = !tokenValid || state === "error";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EAXAU · EMAIL PREFERENCES</Text>
        <MaterialIcons
          name={
            state === "success"
              ? "check-circle"
              : confirm
                ? "mark-email-read"
                : "unsubscribe"
          }
          size={34}
          color={state === "success" ? "#67C7A4" : "#D8BC83"}
        />
        <Text style={styles.title}>
          {invalid
            ? text(
                "链接无效或已过期",
                "Link is invalid or expired",
                "الرابط غير صالح أو منتهي",
              )
            : title}
        </Text>
        <Text style={styles.detail}>
          {invalid
            ? text(
                "请返回 eaxau.com 重新操作。",
                "Return to eaxau.com and try again.",
                "ارجع إلى eaxau.com وحاول مجددا.",
              )
            : detail}
        </Text>
        {state === "idle" && tokenValid ? (
          <Pressable
            accessibilityRole="button"
            onPress={submit}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>
              {confirm
                ? text("确认订阅", "Confirm subscription", "تأكيد الاشتراك")
                : text(
                    "确认退订",
                    "Confirm unsubscribe",
                    "تأكيد إلغاء الاشتراك",
                  )}
            </Text>
          </Pressable>
        ) : state === "working" ? (
          <ActivityIndicator color="#D8BC83" />
        ) : null}
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace("/" as never)}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>
            {text(
              "返回 EAXAU 商城",
              "Return to EAXAU marketplace",
              "العودة إلى سوق EAXAU",
            )}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#070B12",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    padding: 30,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    backgroundColor: "#0D1420",
    alignItems: "flex-start",
    gap: 15,
  },
  eyebrow: {
    color: "#D8BC83",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: { color: "#F4F7FB", fontSize: 24, lineHeight: 31, fontWeight: "900" },
  detail: { color: "#9BA9BC", fontSize: 13, lineHeight: 21 },
  primary: {
    minHeight: 43,
    paddingHorizontal: 18,
    backgroundColor: "#D8BC83",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#07101A", fontSize: 12, fontWeight: "900" },
  secondary: { minHeight: 36, justifyContent: "center" },
  secondaryText: { color: "#AAB7C8", fontSize: 11, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
