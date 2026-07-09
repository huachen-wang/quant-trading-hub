import { View, Text, Platform, Dimensions } from "react-native";
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

  // Web端暂时使用简化展示,移动端可以使用victory-native
  if (Platform.OS === "web") {
    // 计算统计数据
    const startEquity = parseFloat(data[0].equity) || 0;
    const endEquity = parseFloat(data[data.length - 1].equity) || 0;
    const totalReturn = startEquity !== 0 ? ((endEquity - startEquity) / startEquity) * 100 : 0;
    const maxEquity = Math.max(...data.map(d => parseFloat(d.equity) || 0));
    const minEquity = Math.min(...data.map(d => parseFloat(d.equity) || 0));
    const maxDrawdown = maxEquity !== 0 ? ((maxEquity - minEquity) / maxEquity) * 100 : 0;

    return (
      <View className="bg-surface rounded-xl p-4">
        <Text className="text-lg font-semibold text-foreground mb-4">回测数据统计</Text>
        
        <View className="flex-row flex-wrap">
          <View className="w-1/2 mb-4">
            <Text className="text-xs text-muted mb-1">初始权益</Text>
            <Text className="text-xl font-bold text-foreground">
              ${startEquity.toFixed(2)}
            </Text>
          </View>
          
          <View className="w-1/2 mb-4">
            <Text className="text-xs text-muted mb-1">最终权益</Text>
            <Text className="text-xl font-bold text-foreground">
              ${endEquity.toFixed(2)}
            </Text>
          </View>
          
          <View className="w-1/2 mb-4">
            <Text className="text-xs text-muted mb-1">总收益率</Text>
            <Text className={`text-xl font-bold ${totalReturn >= 0 ? 'text-success' : 'text-error'}`}>
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
            </Text>
          </View>
          
          <View className="w-1/2 mb-4">
            <Text className="text-xs text-muted mb-1">最大回撤</Text>
            <Text className="text-xl font-bold text-error">
              -{maxDrawdown.toFixed(2)}%
            </Text>
          </View>
          
          <View className="w-full">
            <Text className="text-xs text-muted mb-1">回测周期</Text>
            <Text className="text-base text-foreground">
              {data.length} 天
            </Text>
          </View>
        </View>
        
        <View className="mt-4 p-3 bg-background rounded-lg">
          <Text className="text-xs text-muted text-center">
            移动端可查看完整权益曲线图表
          </Text>
        </View>
      </View>
    );
  }

  // 移动端使用victory-native (暂时也使用简化版)
  return (
    <View className="bg-surface rounded-xl p-4">
      <Text className="text-lg font-semibold text-foreground mb-2">回测数据</Text>
      <View className="h-64 items-center justify-center">
        <Text className="text-muted">图表功能开发中...</Text>
      </View>
    </View>
  );
}
