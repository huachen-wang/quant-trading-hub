import { memo, useCallback } from "react";
import { StrategyCard } from "@/components/strategy-card";
import type { HomeStrategy } from "./types";

type StrategyListItemProps = {
  item: HomeStrategy;
  onStrategyPress: (id: number) => void;
  onSubscribePress: (title: string) => void;
  imagePriority?: "low" | "normal" | "high";
};

export const StrategyListItem = memo(function StrategyListItem({
  item,
  onStrategyPress,
  onSubscribePress,
  imagePriority,
}: StrategyListItemProps) {
  const handlePress = useCallback(() => onStrategyPress(item.id), [item.id, onStrategyPress]);
  const handleSubscribePress = useCallback(() => onSubscribePress(item.title), [item.title, onSubscribePress]);

  return (
    <StrategyCard
      id={item.id}
      title={item.title}
      platform={item.platform}
      totalReturn={item.totalReturn || "0.00"}
      winRate={item.winRate || "0.00"}
      price={item.price || "0.00"}
      originalPrice={item.originalPrice}
      isFree={item.isFree}
      downloadCount={item.downloadCount}
      virtualDownloads={item.virtualDownloads || 0}
      coverImage={item.coverImage}
      pairs={item.pairs || undefined}
      viewCount={item.viewCount || undefined}
      createdAt={item.createdAt}
      tags={item.tags}
      productType={item.productType}
      isFeatured={!!item.isFeatured}
      isCurated={!!item.isCurated}
      featuredLink={item.featuredLink}
      saleMode={item.saleMode}
      dataStatus={item.dataStatus}
      imagePriority={imagePriority}
      onPress={handlePress}
      onSubscribePress={handleSubscribePress}
    />
  );
});
