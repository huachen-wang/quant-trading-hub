export function isPromoPurchasable(product: {
  isVisible: boolean; status: string; promoEndTime?: Date | string | null; stock?: number;
} | null | undefined, now = Date.now()): boolean {
  if (!product || !product.isVisible || product.status !== "active" || product.stock === 0) return false;
  return !product.promoEndTime || new Date(product.promoEndTime).getTime() > now;
}
