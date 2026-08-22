import { StyleSheet, Text, View } from "react-native";
import { V2 } from "./tokens";

export function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  },
  copy: { minWidth: 0, flex: 1, gap: 5 },
  eyebrow: { color: V2.gold, fontSize: 11, fontWeight: "900", letterSpacing: 0 },
  title: { color: V2.text, fontSize: 24, lineHeight: 31, fontWeight: "900", letterSpacing: 0 },
  detail: { color: V2.textMuted, fontSize: 13, lineHeight: 20, maxWidth: 720 },
  action: { flexShrink: 0 },
});
