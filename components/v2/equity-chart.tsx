import { memo, useId, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import type { EquityPoint } from "@/shared/v2/contracts";
import { useLanguage } from "@/lib/language";
import { V2 } from "./tokens";

type EquityChartProps = {
  points: EquityPoint[];
  color?: string;
  height?: number;
  showAxis?: boolean;
  emptyLabel?: string;
};

const WIDTH = 720;

function makePaths(points: EquityPoint[], height: number) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const top = 12;
  const bottom = height - 20;
  const drawableHeight = bottom - top;
  const coords = points.map((point, index) => ({
    x: (index / (points.length - 1)) * WIDTH,
    y: bottom - ((point.equity - min) / range) * drawableHeight,
  }));
  const line = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const area = `${line} L${WIDTH},${bottom} L0,${bottom} Z`;
  return { line, area, min, max };
}

function EquityChartBase({
  points,
  color = V2.green,
  height = 180,
  showAxis = false,
  emptyLabel,
}: EquityChartProps) {
  const { text } = useLanguage();
  const gradientId = `equityFill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const paths = useMemo(() => makePaths(points, height), [height, points]);
  const resolvedEmptyLabel =
    emptyLabel ?? text("暂无曲线数据", "No chart data", "لا توجد بيانات للرسم");

  if (!paths) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{resolvedEmptyLabel}</Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={text(
        `净值曲线，最低 ${paths.min.toFixed(2)}，最高 ${paths.max.toFixed(2)}`,
        `Equity curve, low ${paths.min.toFixed(2)}, high ${paths.max.toFixed(2)}`,
        `منحنى حقوق الحساب، الأدنى ${paths.min.toFixed(2)}، الأعلى ${paths.max.toFixed(2)}`,
      )}
      style={[styles.wrap, { height }]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.25} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {showAxis
          ? [0.25, 0.5, 0.75].map((ratio) => (
              <Line
                key={ratio}
                x1="0"
                x2={WIDTH}
                y1={height * ratio}
                y2={height * ratio}
                stroke={V2.border}
                strokeOpacity={0.5}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}
        <Path d={paths.area} fill={`url(#${gradientId})`} />
        <Path
          d={paths.line}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </View>
  );
}

export const EquityChart = memo(EquityChartBase);

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden" },
  empty: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: V2.border,
    backgroundColor: V2.surfaceMuted,
  },
  emptyText: { color: V2.textMuted, fontSize: 12 },
});
