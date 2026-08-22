import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import type { EquityPoint } from "@/shared/v2/contracts";
import { V2 } from "./tokens";

type StrategySparklineProps = {
  points: EquityPoint[];
  color: string;
};

const WIDTH = 260;
const HEIGHT = 50;
const PADDING = 5;

function makeLine(points: EquityPoint[]) {
  const sample = points.slice(-32);
  if (sample.length < 2) return null;
  const values = sample.map((point) => point.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const coords = sample.map((point, index) => ({
    x: PADDING + (index / (sample.length - 1)) * (WIDTH - PADDING * 2),
    y:
      HEIGHT -
      PADDING -
      ((point.equity - min) / range) * (HEIGHT - PADDING * 2),
  }));
  const path = coords
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  return { path, min, max, last: coords.at(-1)! };
}

function StrategySparklineBase({ points, color }: StrategySparklineProps) {
  const line = useMemo(() => makeLine(points), [points]);

  if (!line) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>等待时间序列</Text>
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`近期净值轨迹，最低 ${line.min.toFixed(2)}，最高 ${line.max.toFixed(2)}`}
      style={styles.chart}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
      >
        <Line
          x1="0"
          x2={WIDTH}
          y1={HEIGHT / 2}
          y2={HEIGHT / 2}
          stroke={V2.border}
          strokeOpacity={0.55}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d={line.path}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <Circle
          cx={line.last.x}
          cy={line.last.y}
          r="3.2"
          fill={V2.background}
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
    </View>
  );
}

export const StrategySparkline = memo(StrategySparklineBase);

const styles = StyleSheet.create({
  chart: { width: "100%", height: HEIGHT, overflow: "hidden" },
  empty: {
    width: "100%",
    height: HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: V2.border,
  },
  emptyText: { color: V2.textDim, fontSize: 8 },
});
