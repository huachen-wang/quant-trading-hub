import { View, Text } from "react-native";
import { CartesianChart, Line } from "victory-native";
import { useColors } from "@/hooks/use-colors";

interface EquityCurveChartProps {
  data: Array<{
    date: string | Date;
    equity: string;
  }>;
}

export function EquityCurveChart({ data }: EquityCurveChartProps) {
  const colors = useColors();

  if (!data || data.length === 0) {
    return (
      <View className="h-64 items-center justify-center bg-surface rounded-xl">
        <Text className="text-muted">暂无回测数据</Text>
      </View>
    );
  }

  // 转换数据格式
  const chartData = data.map((item, index) => ({
    day: index + 1,
    equity: parseFloat(item.equity),
  }));

  return (
    <View className="bg-surface rounded-xl p-4">
      <Text className="text-lg font-semibold text-foreground mb-2">权益曲线</Text>
      <View className="h-64">
        <CartesianChart
          data={chartData}
          xKey="day"
          yKeys={["equity"]}
          domainPadding={{ left: 20, right: 20, top: 20, bottom: 20 }}
        >
          {({ points }) => (
            <Line
              points={points.equity}
              color={colors.primary}
              strokeWidth={2}
              animate={{ type: "timing", duration: 300 }}
            />
          )}
        </CartesianChart>
      </View>
    </View>
  );
}
