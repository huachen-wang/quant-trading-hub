export function parseGallery(gallery?: string | null): string[] {
  if (!gallery) return [];
  try {
    const parsed = JSON.parse(gallery);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  } catch {
    return [];
  }
}

export function calcDiscount(original?: string | null, promo?: string | null): number {
  const originalPrice = parseFloat(original || "");
  const promoPrice = parseFloat(promo || "");
  if (!originalPrice || !promoPrice || originalPrice <= promoPrice) return 0;
  return Math.round((1 - promoPrice / originalPrice) * 100);
}

export function calcSavings(original?: string | null, promo?: string | null): string {
  const originalPrice = parseFloat(original || "");
  const promoPrice = parseFloat(promo || "");
  return Math.max(0, originalPrice - promoPrice).toFixed(0);
}

export function formatMoney(value?: string | number | null): string {
  const numericValue = typeof value === "number" ? value : parseFloat(value || "");
  if (!Number.isFinite(numericValue)) return "0";
  return numericValue % 1 === 0
    ? numericValue.toFixed(0)
    : numericValue.toFixed(2).replace(/\.?0+$/, "");
}

export function getPromoCardTheme(index: number) {
  const themes = [
    { gradient: ["#7F1D1D", "#991B1B", "#B91C1C"] as const, accent: "#FCA5A5", badge: "#DC2626" },
    { gradient: ["#78350F", "#92400E", "#B45309"] as const, accent: "#E8CC97", badge: "#A8895A" },
    { gradient: ["#1E3A5F", "#1E40AF", "#2563EB"] as const, accent: "#93C5FD", badge: "#3B82F6" },
    { gradient: ["#14532D", "#166534", "#15803D"] as const, accent: "#86EFAC", badge: "#22C55E" },
    { gradient: ["#4C1D95", "#5B21B6", "#7C3AED"] as const, accent: "#C4B5FD", badge: "#8B5CF6" },
    { gradient: ["#831843", "#9D174D", "#BE185D"] as const, accent: "#F9A8D4", badge: "#EC4899" },
  ];
  return themes[index % themes.length];
}

export function getCategoryName(label?: string | null, fallback?: string | null) {
  return label?.replace(/[^\u4e00-\u9fa5A-Za-z]/g, "") || fallback || "";
}
