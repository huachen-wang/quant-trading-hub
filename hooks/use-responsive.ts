import { useState, useEffect } from "react";
import { Dimensions, Platform } from "react-native";

export type ScreenSize = "mobile" | "tablet" | "desktop";

export function useResponsive() {
  const [screenSize, setScreenSize] = useState<ScreenSize>(getScreenSize());

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const handleResize = () => {
      setScreenSize(getScreenSize());
    };

    const subscription = Dimensions.addEventListener("change", handleResize);
    return () => subscription?.remove();
  }, []);

  return {
    screenSize,
    isMobile: screenSize === "mobile",
    isTablet: screenSize === "tablet",
    isDesktop: screenSize === "desktop",
    numColumns: getNumColumns(screenSize),
  };
}

function getScreenSize(): ScreenSize {
  const { width } = Dimensions.get("window");
  
  if (width >= 1024) {
    return "desktop";
  } else if (width >= 768) {
    return "tablet";
  } else {
    return "mobile";
  }
}

function getNumColumns(screenSize: ScreenSize): number {
  switch (screenSize) {
    case "desktop":
      return 3; // 桌面端3列 - 让每个卡片更大更醒目
    case "tablet":
      return 3; // 平板端3列
    case "mobile":
    default:
      return 2; // 移动端2列
  }
}
