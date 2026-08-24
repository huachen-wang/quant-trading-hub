import type { ThemeColorPalette } from "@/constants/theme";

export type AppColors = ThemeColorPalette;
export type GradientColors = readonly [string, string, ...string[]];
export type StrategyDetailData = {
  id: number;
  title: string;
  description?: string | null;
  richDescription?: string | null;
  platform: string;
  productType?: string | null;
  tags?: string | null;
  pairs?: string | null;
  timeframe?: string | null;
  coverImage?: string | null;
  galleryImages?: string | string[] | null;
  isFeatured?: boolean | number | null;
  totalReturn: string | number;
  winRate: string | number;
  maxDrawdown: string | number;
  price: string | number;
  originalPrice?: string | number | null;
  isFree?: boolean | number | null;
  saleMode?: "direct" | "inquiry" | null;
  featuredLink?: string | null;
  downloadAvailable?: boolean;
  sourceName?: string | null;
  sourceUrl?: string | null;
  evidenceUrl?: string | null;
  dataStatus?: "estimated" | "referenced" | "verified" | null;
};

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
