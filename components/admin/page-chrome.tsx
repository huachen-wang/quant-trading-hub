import { type ReactNode } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

type AdminMetric = {
  label: string;
  value: string | number;
  tone?: string;
};

type AdminPageChromeProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  metrics?: AdminMetric[];
  action?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

export function AdminPageChrome({
  eyebrow,
  title,
  subtitle,
  metrics = [],
  action,
  children,
  maxWidth = 1360,
  contentStyle,
}: AdminPageChromeProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
          { maxWidth },
          contentStyle,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerPanel, { borderColor: colors.border }]}>
          <View style={styles.headerMain}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text>
            ) : null}
          </View>
          {action ? <View style={styles.headerAction}>{action}</View> : null}
        </View>

        {metrics.length > 0 ? (
          <View style={styles.metricsGrid}>
            {metrics.map((item) => {
              const tone = item.tone || colors.primary;
              return (
                <View
                  key={item.label}
                  style={[
                    styles.metricCard,
                    isDesktop && styles.metricCardDesktop,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.metricLabel, { color: colors.muted }]}>{item.label}</Text>
                  <Text style={[styles.metricValue, { color: tone }]}>{item.value}</Text>
                  <View style={[styles.metricRule, { backgroundColor: tone }]} />
                </View>
              );
            })}
          </View>
        ) : null}

        {children}
      </ScrollView>
    </ScreenContainer>
  );
}

export function AdminSection({
  title,
  meta,
  children,
  style,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();

  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        {meta ? <Text style={[styles.sectionMeta, { color: colors.muted }]}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: "100%",
    padding: 16,
    paddingBottom: 40,
  },
  scrollContentDesktop: {
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 46,
  },
  headerPanel: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 15,
    marginBottom: 12,
    backgroundColor: "rgba(9,15,28,0.84)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 6,
  },
  title: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  headerAction: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    minWidth: "47%" as any,
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
  },
  metricCardDesktop: {
    minWidth: 0,
    flexBasis: 0,
    flexGrow: 1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 23,
    lineHeight: 28,
    fontWeight: "900",
  },
  metricRule: {
    width: 42,
    height: 2,
    borderRadius: 2,
    marginTop: 10,
    opacity: 0.72,
  },
  section: {
    marginTop: 2,
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  sectionMeta: {
    fontSize: 10,
    fontWeight: "900",
  },
});
