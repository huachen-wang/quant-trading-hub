export type PromoCategoryKey = "" | "ea" | "indicator" | "tool" | "course";

export type PromoCategory = {
  key: PromoCategoryKey;
  label: string;
  icon: string;
};

export type PromoMetrics = {
  winRate?: string;
  profit?: string;
  drawdown?: string;
  trades?: string;
};

export type PromoProduct = {
  id: number;
  title: string;
  description?: string | null;
  platform?: string | null;
  category?: PromoCategoryKey | string | null;
  originalPrice?: string | null;
  promoPrice?: string | null;
  promoLabel?: string | null;
  promoEndTime?: string | null;
  stock?: number | null;
  soldCount?: number | null;
  detailContent?: string | null;
  coverImage?: string | null;
  galleryImages?: string | null;
  paymentInfo?: string | null;
  contactInfo?: string | null;
  status?: string | null;
  metrics?: PromoMetrics | null;
};

export type PromoContactInfo = {
  telegram: string;
  qq1: string;
  qq2: string;
  wechat1: string;
  wechat2: string;
};
