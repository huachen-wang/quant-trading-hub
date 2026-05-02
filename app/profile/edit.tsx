import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { glassStyle } from "@/lib/glass-styles";
import { getApiBaseUrl } from "@/constants/oauth";

/**
 * 用户资料编辑页
 *
 * URL: /profile/edit
 *
 * 功能：
 *   - 修改昵称
 *   - 修改头像 URL
 *   - 修改密码（需输入旧密码或邮箱验证码）
 */
export default function ProfileEditScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isAuthenticated, loading, refresh } = useAuth();

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bio, setBio] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // 加载当前资料
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setAvatar(user.avatar || "");
      setBio(user.bio || "");
    }
  }, [user]);

  if (!loading && !isAuthenticated) {
    router.replace("/auth/login" as any);
    return null;
  }

  const showMsg = (msg: string) => {
    if (Platform.OS === "web") alert(msg);
    else Alert.alert("提示", msg);
  };

  const handleSaveProfile = async () => {
    setBusy(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim() || undefined,
          avatar: avatar.trim() || undefined,
          bio: bio.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "保存失败");
      }
      showMsg("资料已更新");
      refresh();
    } catch (e: any) {
      showMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) return showMsg("请填写完整密码");
    if (newPassword.length < 6) return showMsg("新密码至少 6 位");
    setBusy(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "修改失败");
      }
      showMsg("密码已修改，请用新密码登录");
      setOldPassword("");
      setNewPassword("");
    } catch (e: any) {
      showMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* 顶部 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: colors.foreground, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>编辑资料</Text>
        </View>

        {/* 头像预览 */}
        <View style={[styles.card, { backgroundColor: colors.surface }, glassStyle("subtle") as any]}>
          <View style={styles.avatarPreviewBox}>
            <View style={styles.avatarBig}>
              {avatar ? (
                <View style={[styles.avatarImg, { backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {avatar.substring(0, 30)}...
                  </Text>
                </View>
              ) : (
                <Text style={styles.avatarLetter}>
                  {(name || user?.name || "U").charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={[styles.avatarHint, { color: colors.muted }]}>
              头像预览（用名字首字母自动生成）
            </Text>
          </View>
        </View>

        {/* 资料表单 */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>基础信息</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.muted }]}>昵称</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="您的昵称"
            placeholderTextColor={colors.muted}
            maxLength={50}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />

          <Text style={[styles.label, { color: colors.muted, marginTop: 12 }]}>头像 URL（选填）</Text>
          <TextInput
            value={avatar}
            onChangeText={setAvatar}
            placeholder="https://..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />
          <Text style={[styles.helpText, { color: colors.muted }]}>
            支持外链图片地址。后续会支持直接上传图片。
          </Text>

          <Text style={[styles.label, { color: colors.muted, marginTop: 12 }]}>个人简介</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="介绍一下自己..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            maxLength={200}
            style={[
              styles.input,
              {
                color: colors.foreground,
                borderColor: colors.border,
                minHeight: 80,
                textAlignVertical: "top",
              },
            ]}
          />

          <TouchableOpacity
            onPress={handleSaveProfile}
            disabled={busy}
            style={[styles.cta, { marginTop: 16 }]}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#D97706", "#F59E0B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaInner}
            >
              {busy ? (
                <ActivityIndicator color="#0F172A" size="small" />
              ) : (
                <Text style={styles.ctaText}>保存修改</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 修改密码 */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>安全设置</Text>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.muted }]}>当前密码</Text>
          <TextInput
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="当前密码"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />

          <Text style={[styles.label, { color: colors.muted, marginTop: 12 }]}>新密码</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="至少 6 位"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
          />

          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={busy}
            style={[styles.cta, { marginTop: 16 }]}
            activeOpacity={0.85}
          >
            <View style={[styles.ctaInner, { backgroundColor: "rgba(96,165,250,0.15)", borderWidth: 1, borderColor: "rgba(96,165,250,0.3)" }]}>
              {busy ? (
                <ActivityIndicator color="#93c5fd" size="small" />
              ) : (
                <Text style={[styles.ctaText, { color: "#93c5fd" }]}>修改密码</Text>
              )}
            </View>
          </TouchableOpacity>

          <Text style={[styles.helpText, { color: colors.muted, marginTop: 8 }]}>
            如忘记密码，请先退出登录后通过「忘记密码」流程重置。
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  title: { fontSize: 22, fontWeight: "900" },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: "800", marginTop: 12, marginBottom: 6, letterSpacing: 0.5 },
  avatarPreviewBox: { alignItems: "center" },
  avatarBig: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(59,130,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarImg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  avatarLetter: { color: "#93c5fd", fontSize: 36, fontWeight: "900" },
  avatarHint: { fontSize: 11 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  helpText: { fontSize: 11, marginTop: 4 },
  cta: { borderRadius: 10, overflow: "hidden" },
  ctaInner: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  ctaText: { color: "#0F172A", fontWeight: "800", fontSize: 14 },
});
