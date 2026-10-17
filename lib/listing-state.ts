/**
 * 后台维护的公开清单（促销商品、合作策略档案、合作方案）在页面上的四种状态（2026-10-18，代码体检 R3 ⑥）。
 *
 * 原来接口返回空或请求失败时，页面会换成代码里写死的演示商品、价格和库存；
 * 合作页桌面端在真实记录不足三条时，还会补进演示条目。访客分不清哪些是真的。
 * 现在只有四种结果：
 * - loading：还在读；
 * - error：没读到（临时故障），页面如实说读取失败，不拿任何写死的内容顶替；
 * - empty：读到了，确实没有记录，页面显示空状态或干脆不显示这一栏；
 * - ok：只有后台真实记录，不补位、不混入演示数据。
 */
export type ListingState<T> =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "empty" }
  | { kind: "ok"; items: T[] };

export function listingState<T>(query: {
  data?: readonly T[] | null;
  isLoading?: boolean;
  isError?: boolean;
}): ListingState<T> {
  const items = Array.isArray(query.data) ? [...query.data] : null;
  if (items && items.length > 0) return { kind: "ok", items };
  if (query.isError) return { kind: "error" };
  if (query.isLoading || !items) return { kind: "loading" };
  return { kind: "empty" };
}

/** 页面上要渲染的条目：只有 ok 才有，其余一律空数组（不补位、不演示）。 */
export function listingItems<T>(state: ListingState<T>): T[] {
  return state.kind === "ok" ? state.items : [];
}
