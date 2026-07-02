import type { ThemeColorPalette } from "@/constants/theme";

export type AppColors = ThemeColorPalette;
export type GradientColors = readonly [string, string, ...string[]];
export type StrategyDetailData = any;

export type StrategyReview = {
  id: number | string;
  nickname?: string | null;
  content: string;
  createdAt: Date | string;
};

export type StrategyComment = {
  id: number;
  user?: {
    name?: string | null;
  };
  content: string;
  createdAt: Date | string;
};
