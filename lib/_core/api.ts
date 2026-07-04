import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";

const DEBUG_API = process.env.EXPO_PUBLIC_DEBUG_API === "true";

function debugApi(...args: unknown[]) {
  if (DEBUG_API) console.log(...args);
}

function debugApiError(...args: unknown[]) {
  if (DEBUG_API) console.error(...args);
}

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type EmailAuthResponse = {
  app_session_id?: string;
  user?: any;
};

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Auth method:
  // - Prefer Bearer token when available (native + web fallback).
  // - Browser cookies still work via credentials: "include".
  const sessionToken = await Auth.getSessionToken();
  debugApi("[API] apiCall:", {
    endpoint,
    platform: Platform.OS,
    hasToken: !!sessionToken,
    method: options.method || "GET",
  });
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
    debugApi("[API] Authorization header added");
  }

  const baseUrl = getApiBaseUrl();
  // Ensure no double slashes between baseUrl and endpoint
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;
  debugApi("[API] Full URL:", url);

  try {
    debugApi("[API] Making request...");
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    debugApi("[API] Response status:", response.status, response.statusText);
    const responseHeaders = Object.fromEntries(response.headers.entries());
    debugApi("[API] Response headers:", responseHeaders);

    // Check if Set-Cookie header is present (cookies are automatically handled in React Native)
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie) {
      debugApi("[API] Set-Cookie header received");
    }

    if (!response.ok) {
      const errorText = await response.text();
      debugApiError("[API] Error response:", errorText);
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {
        // Not JSON, use text as is
      }
      throw new Error(errorMessage || `API call failed: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      debugApi("[API] JSON response received");
      return data as T;
    }

    const text = await response.text();
    debugApi("[API] Text response received");
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    debugApiError("[API] Request failed:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred");
  }
}

// OAuth callback handler - exchange code for session token
// Calls /api/oauth/mobile endpoint which returns JSON with app_session_id and user
export async function exchangeOAuthCode(
  code: string,
  state: string,
): Promise<{ sessionToken: string; user: any }> {
  debugApi("[API] exchangeOAuthCode called");
  // Use GET with query params
  const params = new URLSearchParams({ code, state });
  const endpoint = `/api/oauth/mobile?${params.toString()}`;
  debugApi("[API] Calling OAuth mobile endpoint:", endpoint);
  const result = await apiCall<{ app_session_id: string; user: any }>(endpoint);

  // Convert app_session_id to sessionToken for compatibility
  const sessionToken = result.app_session_id;
  debugApi("[API] OAuth exchange result:", {
    hasSessionToken: !!sessionToken,
    hasUser: !!result.user,
  });

  return {
    sessionToken,
    user: result.user,
  };
}

// Logout
export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
}

export async function registerWithEmail(
  email: string,
  password: string,
  name?: string,
): Promise<EmailAuthResponse> {
  return apiCall<EmailAuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function loginWithEmail(email: string, password: string): Promise<EmailAuthResponse> {
  return apiCall<EmailAuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Get current authenticated user (web uses cookie-based auth)
export async function getMe(): Promise<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  bio: string | null;
  loginMethod: string | null;
  role: string;
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: any }>("/api/auth/me");
    return result.user || null;
  } catch (error) {
    debugApiError("[API] getMe failed:", error);
    return null;
  }
}

// Establish session cookie on the backend (3000-xxx domain)
// Called after receiving token via postMessage to get a proper Set-Cookie from the backend
export async function establishSession(token: string): Promise<boolean> {
  try {
    debugApi("[API] establishSession: setting cookie on backend...");
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/auth/session`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include", // Important: allows Set-Cookie to be stored
    });

    if (!response.ok) {
      debugApiError("[API] establishSession failed:", response.status);
      return false;
    }

    debugApi("[API] establishSession: cookie set successfully");
    return true;
  } catch (error) {
    debugApiError("[API] establishSession error:", error);
    return false;
  }
}
