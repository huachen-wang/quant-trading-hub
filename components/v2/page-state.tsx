import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLanguage } from "@/lib/language";
import { V2 } from "./tokens";

export function V2LoadingState({ label }: { label?: string }) {
  const { text } = useLanguage();
  return (
    <View accessibilityLiveRegion="polite" style={styles.state}>
      <ActivityIndicator color={V2.gold} size="large" />
      <Text style={styles.title}>
        {label ?? text("正在同步数据", "Syncing data", "جارٍ مزامنة البيانات")}
      </Text>
      <Text style={styles.detail}>
        {text(
          "页面结构保持稳定，数据返回后会自动更新。",
          "The layout remains stable and updates when data arrives.",
          "يبقى التخطيط ثابتا ويتم تحديثه عند وصول البيانات.",
        )}
      </Text>
    </View>
  );
}

export function V2ErrorState({
  title,
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  const { text } = useLanguage();
  return (
    <View accessibilityRole="alert" style={styles.state}>
      <MaterialIcons name="sync-problem" size={32} color={V2.amber} />
      <Text style={styles.title}>
        {title ??
          text(
            "数据暂时不可用",
            "Data is temporarily unavailable",
            "البيانات غير متاحة مؤقتا",
          )}
      </Text>
      <Text style={styles.detail}>
        {detail ??
          text(
            "请检查服务连接后重试。",
            "Check the service connection and try again.",
            "تحقق من اتصال الخدمة ثم حاول مرة أخرى.",
          )}
      </Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <MaterialIcons name="refresh" size={18} color={V2.background} />
          <Text style={styles.buttonText}>
            {text("重新加载", "Reload", "إعادة التحميل")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    minHeight: 420,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
    backgroundColor: V2.background,
  },
  title: { color: V2.text, fontSize: 17, fontWeight: "800", letterSpacing: 0 },
  detail: {
    color: V2.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 4,
    backgroundColor: V2.gold,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  buttonText: { color: V2.background, fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.76 },
});
