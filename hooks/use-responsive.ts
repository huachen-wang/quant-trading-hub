import { useState, useEffect } from "react";
import { Dimensions, Platform } from "react-native";

export type ScreenSize = "mobile" | "tablet" | "desktop";

export function useResponsive() {
  const [windowWidth, setWindowWidth] = useState(getWindowWidth());

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }

    const handleResize = () => {
      setWindowWidth(getWindowWidth());
    };

    const subscription = Dimensions.addEventListener("change", handleResize);
    return () => subscription?.remove();
  }, []);

  const screenSize = getScreenSize(windowWidth);

  return {
    windowWidth,
    screenSize,
    isMobile: screenSize === "mobile",
    isTablet: screenSize === "tablet",
    isDesktop: screenSize === "desktop",
    numColumns: getNumColumns(screenSize, windowWidth),
  };
}

function getWindowWidth(): number {
  return Dimensions.get("window").width;
}

function getScreenSize(width: number): ScreenSize {
  if (width >= 1024) {
    return "desktop";
  } else if (width >= 768) {
    return "tablet";
  } else {
    return "mobile";
  }
}

function getNumColumns(screenSize: ScreenSize, width: number): number {
  switch (screenSize) {
    case "desktop":
      if (width >= 1680) return 5;
      if (width >= 1240) return 4;
      return 4;
    case "tablet":
      return 3; // 平板端3列（保持）
    case "mobile":
    default:
      return 2; // 移动端2列
  }
}
