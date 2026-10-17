import type { PromoCategory } from "./types";

export const PROMO_CATEGORIES: PromoCategory[] = [
  { key: "", label: "全部精选", icon: "diamond" },
  { key: "ea", label: "EA策略", icon: "trending-up" },
  { key: "indicator", label: "指标工具", icon: "analytics" },
  { key: "tool", label: "辅助工具", icon: "construct" },
  { key: "course", label: "实战教程", icon: "book" },
];

export const PROMO_ANNOUNCEMENTS = [
  "EA 商品与资管入金使用独立 USDT 对账记录",
  "商品价格、库存、交付内容以当次订单为准",
  "源码来源与商业授权须在购买前逐项核验",
  "历史、模拟或回测数据不代表未来表现",
];

/* 2026-10-18（代码体检 R3 ⑥）：原来这里有一组写死的演示商品（名称、原价、促销价、库存、已售），
   促销接口返回空或失败时会被当成真实商品显示。已删除：页面只展示后台真实记录，
   空和失败各有自己的状态（app/promo.tsx、lib/listing-state.ts）。本地开发看样例用服务端 mock（server/mock-data.ts）。 */
