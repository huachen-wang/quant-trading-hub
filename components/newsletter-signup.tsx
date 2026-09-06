import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLanguage } from "@/lib/language";
import { trpc } from "@/lib/trpc";
import { EAXAU_EMAIL_NOTICE_VERSION } from "@/shared/email-subscription";

function currentAttribution() {
  if (Platform.OS !== "web" || typeof window === "undefined") return {};
  const search = new URLSearchParams(window.location.search);
  const pairs = [
    ["utmSource", search.get("utm_source"), 120],
    ["utmMedium", search.get("utm_medium"), 120],
    ["utmCampaign", search.get("utm_campaign"), 160],
    ["utmContent", search.get("utm_content"), 160],
    ["utmTerm", search.get("utm_term"), 160],
    ["referrer", typeof document !== "undefined" ? document.referrer : "", 300],
  ] as const;
  return Object.fromEntries(
    pairs
      .filter(([, value]) => value)
      .map(([key, value, max]) => [key, value!.slice(0, max)]),
  );
}

export function NewsletterSignup() {
  const { language, text } = useLanguage();
  const [email, setEmail] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const attribution = useMemo(currentAttribution, []);
  const request = trpc.subscriptions.requestEmailConfirmation.useMutation();

  const submit = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
      setError(
        text(
          "请输入有效邮箱",
          "Enter a valid email",
          "أدخل بريدا إلكترونيا صالحا",
        ),
      );
      return;
    }
    if (!consentAccepted) {
      setError(
        text(
          "请先确认订阅范围",
          "Confirm the subscription scope",
          "أكد نطاق الاشتراك أولا",
        ),
      );
      return;
    }
    setError("");
    try {
      await request.mutateAsync({
        email: normalized,
        consentAccepted: true,
        locale: language,
        attribution,
      });
      setSubmitted(true);
      setEmail("");
      setConsentAccepted(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : text(
              "暂时无法订阅，请稍后再试",
              "Subscription is temporarily unavailable",
              "الاشتراك غير متاح مؤقتا",
            ),
      );
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.copy}>
        <View style={styles.eyebrowRow}>
          <MaterialIcons name="mail-outline" size={15} color="#D8BC83" />
          <Text style={styles.eyebrow}>EAXAU EMAIL</Text>
        </View>
        <Text style={styles.title}>
          {text(
            "EA 产品更新与实用教程",
            "EA updates and practical guides",
            "تحديثات EA وأدلة عملية",
          )}
        </Text>
        <Text style={styles.detail}>
          {text(
            "确认邮件后生效。只发送 EAXAU 的产品更新与教育内容，可随时退订。",
            "Starts after email confirmation. EAXAU product updates and educational content only. Unsubscribe at any time.",
            "يبدأ بعد تأكيد البريد. تحديثات منتجات EAXAU والمحتوى التعليمي فقط. يمكنك إلغاء الاشتراك في أي وقت.",
          )}
        </Text>
      </View>

      <View style={styles.form}>
        {submitted ? (
          <View accessibilityRole="alert" style={styles.success}>
            <MaterialIcons name="mark-email-read" size={18} color="#67C7A4" />
            <Text style={styles.successText}>
              {text(
                "确认邮件已进入发送队列，请查收邮箱。",
                "Your confirmation email is queued. Check your inbox.",
                "تمت إضافة رسالة التأكيد إلى قائمة الإرسال. تحقق من بريدك.",
              )}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.actionRow}>
              <TextInput
                accessibilityLabel={text(
                  "订阅邮箱",
                  "Subscription email",
                  "بريد الاشتراك",
                )}
                value={email}
                onChangeText={setEmail}
                placeholder={text("你的邮箱", "Your email", "بريدك الإلكتروني")}
                placeholderTextColor="#68768A"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={254}
                style={styles.input}
                onSubmitEditing={submit}
              />
              <Pressable
                accessibilityRole="button"
                disabled={request.isPending}
                onPress={submit}
                style={({ pressed }) => [
                  styles.button,
                  (pressed || request.isPending) && styles.buttonPressed,
                ]}
              >
                {request.isPending ? (
                  <ActivityIndicator size="small" color="#07101A" />
                ) : (
                  <Text style={styles.buttonText}>
                    {text("订阅", "Subscribe", "اشترك")}
                  </Text>
                )}
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentAccepted }}
              accessibilityLabel={text(
                "同意接收 EAXAU 的 EA 产品更新与教育内容",
                "Agree to receive EAXAU EA product updates and educational content",
                "أوافق على تلقي تحديثات منتجات EA والمحتوى التعليمي من EAXAU",
              )}
              onPress={() => setConsentAccepted((value) => !value)}
              style={styles.consentRow}
            >
              <View
                style={[
                  styles.checkbox,
                  consentAccepted && styles.checkboxChecked,
                ]}
              >
                {consentAccepted ? (
                  <MaterialIcons name="check" size={12} color="#07101A" />
                ) : null}
              </View>
              <Text style={styles.consentText}>
                {text(
                  "我同意接收上述 EAXAU 邮件；确认前不会生效。",
                  "I agree to the EAXAU emails described above; it stays inactive until I confirm.",
                  "أوافق على رسائل EAXAU الموضحة أعلاه؛ لن يصبح الاشتراك نشطا قبل التأكيد.",
                )}
              </Text>
            </Pressable>
            <Text style={styles.noticeVersion}>
              NOTICE {EAXAU_EMAIL_NOTICE_VERSION}
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 22,
    marginHorizontal: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(9,14,23,0.84)",
    flexDirection: Platform.OS === "web" ? "row" : "column",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 18,
  },
  copy: { flex: 1, minWidth: 230, gap: 5 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  eyebrow: {
    color: "#D8BC83",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  title: { color: "#F4F7FB", fontSize: 15, lineHeight: 20, fontWeight: "800" },
  detail: { color: "#8D9AAF", fontSize: 11, lineHeight: 17, maxWidth: 520 },
  form: { flex: 1, minWidth: 280, maxWidth: 600, gap: 8 },
  actionRow: { flexDirection: "row", alignItems: "stretch", gap: 7 },
  input: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    backgroundColor: "rgba(2,6,23,0.62)",
    color: "#F4F7FB",
    paddingHorizontal: 12,
    fontSize: 12,
  },
  button: {
    minWidth: 86,
    minHeight: 40,
    paddingHorizontal: 15,
    backgroundColor: "#D8BC83",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: "#07101A", fontSize: 11, fontWeight: "900" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  checkbox: {
    width: 16,
    height: 16,
    marginTop: 1,
    borderWidth: 1,
    borderColor: "rgba(216,188,131,0.58)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#D8BC83" },
  consentText: { flex: 1, color: "#8D9AAF", fontSize: 10, lineHeight: 15 },
  noticeVersion: { color: "#536176", fontSize: 8, fontWeight: "700" },
  error: { color: "#F38B8B", fontSize: 10, lineHeight: 14 },
  success: {
    minHeight: 52,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(103,199,164,0.32)",
    backgroundColor: "rgba(103,199,164,0.07)",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  successText: {
    flex: 1,
    color: "#B9E2D3",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "700",
  },
});
