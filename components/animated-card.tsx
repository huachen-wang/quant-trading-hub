import { useEffect, useRef } from "react";
import { Animated, Platform, ViewProps } from "react-native";

interface AnimatedCardProps extends ViewProps {
  index?: number;
  delay?: number;
  children: React.ReactNode;
}

/**
 * 带入场动画的卡片容器
 * 卡片从下方淡入，带有交错延迟效果
 */
export function AnimatedCard({ index = 0, delay = 0, children, style, ...props }: AnimatedCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const staggerDelay = delay + index * 80;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 350,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    }, staggerDelay);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        {
          opacity: fadeAnim,
          transform: [{ translateY }],
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Animated.View>
  );
}
