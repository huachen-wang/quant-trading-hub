import { View, Text } from "react-native";
import { CartesianChart, Bar } from "victory-native";
import { useColors } from "@/hooks/use-colors";

interface MonthlyReturnsChartProps {
  data: Array<{
    month: string;
    return: number;
  }>;
}

export function MonthlyReturnsChart({ data }: MonthlyReturnsChartProps) {
  const colors = useColors();

  if (!data || data.length === 0) {
    return (
      <View className="h-64 items-center justify-center bg-surface rounded-xl">
        <Text className="text-muted">暂无月度数据</Text>
      </View>
    );
  }

  const chartData = data.map((item, index) => ({
    month: index + 1,
    value: item.return,
  }));

  return (
    <View className="bg-surface rounded-xl p-4">
      <Text className="text-lg font-semibold text-foreground mb-2">月度收益</Text>
      <View className="h-64">
        <CartesianChart
          data={chartData}
          xKey="month"
          yKeys={["value"]}
          domainPadding={{ left: 20, right: 20, top: 20, bottom: 20 }}
        >
          {({ points, chartBounds }) => (
            <Bar
              points={points.value}
              chartBounds={chartBounds}
              color={colors.primary}
              barWidth={20}
              animate={{ type: "timing", duration: 300 }}
            />
          )}
        </CartesianChart>
      </View>
    </View>
  );
}
