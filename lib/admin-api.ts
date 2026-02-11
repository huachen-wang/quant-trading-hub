/**
 * Admin专用API客户端
 * 所有admin页面使用此客户端发送请求，自动携带X-Admin-Token header
 */
import { getApiBaseUrl } from "@/constants/oauth";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * 从存储中获取admin token
 */
export async function getAdminToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    // Web端使用sessionStorage
    const sessionToken = sessionStorage.getItem("admin_token");
    if (sessionToken) {
      return sessionToken;
    }

    const legacyToken = localStorage.getItem("admin_token");
    if (legacyToken) {
      const legacyEmail = localStorage.getItem("admin_email");
      sessionStorage.setItem("admin_token", legacyToken);
      if (legacyEmail) {
        sessionStorage.setItem("admin_email", legacyEmail);
      }
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_email");
    }

    return sessionStorage.getItem("admin_token");
  } else {
    // 移动端使用SecureStore
    return await SecureStore.getItemAsync("admin_token");
  }
}

export async function clearAdminToken(): Promise<void> {
  if (Platform.OS === "web") {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_email");
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");
    return;
  }

  await SecureStore.deleteItemAsync("admin_token");
  await SecureStore.deleteItemAsync("admin_email");
}

type FetchOptions = {
  method?: string;
  body?: any;
};

/**
 * 通用admin API调用函数
 * 直接通过fetch调用tRPC API，携带admin认证header
 */
async function adminFetch(path: string, options: FetchOptions = {}) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/trpc/${path}`;
  
  console.log("[admin-api] Fetching:", url);
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const adminToken = await getAdminToken();
  if (adminToken) {
    headers["X-Admin-Token"] = adminToken;
  }

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
    credentials: "include",
  };

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, fetchOptions);
    console.log("[admin-api] Response status:", res.status);
    
    if (!res.ok) {
      console.error("[admin-api] HTTP error:", res.status, res.statusText);
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log("[admin-api] Response data:", data);
    
    if (data.error) {
      // tRPC with superjson wraps errors in {json: {message, code, data}}
      const errorMsg = data.error?.json?.message || data.error?.message || "API Error";
      console.error("[admin-api] API error:", errorMsg);
      throw new Error(errorMsg);
    }
    
    // tRPC with superjson wraps data in {json: ..., meta: ...}
    const resultData = data.result?.data;
    return resultData?.json !== undefined ? resultData.json : resultData;
  } catch (error) {
    console.error("[admin-api] Fetch failed:", error);
    throw error;
  }
}

/**
 * tRPC query调用（GET请求）
 * input会被序列化为URL参数
 */
export async function adminQuery(procedure: string, input?: any) {
  let path = procedure;
  if (input !== undefined) {
    // tRPC v11 with superjson: input needs to be wrapped
    const encoded = encodeURIComponent(JSON.stringify({ json: input }));
    path = `${procedure}?input=${encoded}`;
  }
  return adminFetch(path);
}

/**
 * tRPC mutation调用（POST请求）
 */
export async function adminMutation(procedure: string, input?: any) {
  const body = input !== undefined ? { json: input } : { json: {} };
  return adminFetch(procedure, {
    method: "POST",
    body,
  });
}

// ============= 策略管理 =============

export async function getAdminStrategies(params?: { status?: string; limit?: number; offset?: number }) {
  return adminQuery("admin.strategies.list", params || {});
}

export async function createAdminStrategy(data: any) {
  return adminMutation("admin.strategies.create", data);
}

export async function updateAdminStrategy(data: any) {
  return adminMutation("admin.strategies.update", data);
}

export async function deleteAdminStrategy(id: number) {
  return adminMutation("admin.strategies.delete", { id });
}

// ============= 评论管理 =============

export async function getAdminComments(params?: { limit?: number; offset?: number }) {
  return adminQuery("admin.comments.list", params || {});
}

export async function deleteAdminComment(id: number) {
  return adminMutation("admin.comments.delete", { id });
}

// ============= 匿名评论管理 =============

export async function getAnonymousCommentsByStrategy(strategyId: number, limit?: number, offset?: number) {
  return adminQuery("anonymousComments.list", { strategyId, limit, offset });
}

export async function deleteAnonymousComment(id: number) {
  return adminMutation("anonymousComments.delete", { id });
}

// ============= 统计 =============

export async function getAdminStats() {
  return adminQuery("admin.stats.overview");
}

// ============= 通知管理 =============

export async function getAdminNotifications(params?: { limit?: number; offset?: number }) {
  return adminQuery("notifications.list", params || {});
}

export async function createNotification(data: any) {
  return adminMutation("notifications.create", data);
}

export async function updateNotification(data: any) {
  return adminMutation("notifications.update", data);
}

export async function deleteNotification(id: number) {
  return adminMutation("notifications.delete", { id });
}

// ============= 页面内容管理 =============

export async function getAdminPageContents(pageKey?: string) {
  return adminQuery("pageContents.getAll", { pageKey });
}

export async function createPageContent(data: any) {
  return adminMutation("pageContents.create", data);
}

export async function updatePageContent(data: any) {
  return adminMutation("pageContents.update", data);
}

export async function deletePageContent(id: number) {
  return adminMutation("pageContents.delete", { id });
}

// ============= 订阅管理 =============

export async function getSubscribers(params?: { limit?: number; offset?: number }) {
  return adminQuery("subscriptions.list", params || {});
}

// ============= 站点设置 =============

export async function getSiteSettings() {
  return adminQuery("siteSettings.getAll");
}

export async function updateSiteSetting(key: string, value: string, description?: string) {
  return adminMutation("siteSettings.update", { key, value, description });
}

// ============= 上架申请管理 =============

export async function getListingRequests(params?: { status?: string; limit?: number; offset?: number }) {
  return adminQuery("listingRequests.list", params || {});
}

export async function updateListingRequestStatus(id: number, status: string, notes?: string) {
  return adminMutation("listingRequests.updateStatus", { id, status, notes });
}

// ============= 合购管理 =============

export async function getAdminGroupBuys(params?: { limit?: number; offset?: number }) {
  return adminQuery("groupBuys.adminList", params || {});
}

export async function createGroupBuy(data: any) {
  return adminMutation("groupBuys.create", data);
}

export async function updateGroupBuy(data: any) {
  return adminMutation("groupBuys.update", data);
}

export async function deleteGroupBuy(id: number) {
  return adminMutation("groupBuys.delete", { id });
}

// ============= 上架申请管理 =============

export async function deleteListingRequest(id: number) {
  return adminMutation("listingRequests.delete", { id });
}
