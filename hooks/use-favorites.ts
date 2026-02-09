import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITES_KEY = "@quant_trading_hub:favorites";

export interface FavoriteStrategy {
  id: number;
  title: string;
  platform: string;
  totalReturn: string;
  winRate: string;
  price: string;
  isFree: boolean;
  addedAt: string;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteStrategy[]>([]);
  const [loading, setLoading] = useState(true);

  // 加载收藏列表
  const loadFavorites = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(FAVORITES_KEY);
      if (data) {
        setFavorites(JSON.parse(data));
      }
    } catch (error) {
      console.error("Failed to load favorites:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 保存收藏列表
  const saveFavorites = useCallback(async (newFavorites: FavoriteStrategy[]) => {
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      setFavorites(newFavorites);
    } catch (error) {
      console.error("Failed to save favorites:", error);
    }
  }, []);

  // 检查是否已收藏
  const isFavorite = useCallback(
    (strategyId: number) => {
      return favorites.some((fav) => fav.id === strategyId);
    },
    [favorites]
  );

  // 添加收藏
  const addFavorite = useCallback(
    async (strategy: Omit<FavoriteStrategy, "addedAt">) => {
      const newFavorite: FavoriteStrategy = {
        ...strategy,
        addedAt: new Date().toISOString(),
      };
      const newFavorites = [newFavorite, ...favorites];
      await saveFavorites(newFavorites);
    },
    [favorites, saveFavorites]
  );

  // 移除收藏
  const removeFavorite = useCallback(
    async (strategyId: number) => {
      const newFavorites = favorites.filter((fav) => fav.id !== strategyId);
      await saveFavorites(newFavorites);
    },
    [favorites, saveFavorites]
  );

  // 切换收藏状态
  const toggleFavorite = useCallback(
    async (strategy: Omit<FavoriteStrategy, "addedAt">) => {
      if (isFavorite(strategy.id)) {
        await removeFavorite(strategy.id);
        return false;
      } else {
        await addFavorite(strategy);
        return true;
      }
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  // 清空所有收藏
  const clearFavorites = useCallback(async () => {
    await saveFavorites([]);
  }, [saveFavorites]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return {
    favorites,
    loading,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
  };
}
