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
    { gradient: ["#120D08", "#241A10", "#49351C"] as const, accent: "#E5C98A", badge: "#A8895A" },
    { gradient: ["#07111F", "#11243A", "#1E3A5F"] as const, accent: "#93B4D1", badge: "#41607A" },
    { gradient: ["#06140F", "#12382B", "#1F6B50"] as const, accent: "#8FE3C1", badge: "#1F8A64" },
    { gradient: ["#0B1018", "#182334", "#334155"] as const, accent: "#CBD5E1", badge: "#64748B" },
    { gradient: ["#140D08", "#2B1A10", "#5A341F"] as const, accent: "#E8B875", badge: "#A16207" },
    { gradient: ["#061316", "#113139", "#205461"] as const, accent: "#9ADCE8", badge: "#23879A" },
  ];
  return themes[index % themes.length];
}

export function getCategoryName(label?: string | null, fallback?: string | null) {
  return label?.replace(/[^\u4e00-\u9fa5A-Za-z]/g, "") || fallback || "";
}
