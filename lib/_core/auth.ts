import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

const DEBUG_AUTH = process.env.EXPO_PUBLIC_DEBUG_AUTH === "true";

function debugAuth(...args: unknown[]) {
  if (DEBUG_AUTH) console.log(...args);
}

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  bio: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  lastSignedIn: Date;
};

export async function getSessionToken(): Promise<string | null> {
  try {
    // Web: keep a token fallback in localStorage for Authorization header.
    if (Platform.OS === "web") {
      const token = window.localStorage.getItem(SESSION_TOKEN_KEY);
      debugAuth(
        "[Auth] Web session token from localStorage:",
        token ? `present (${token.substring(0, 20)}...)` : "missing",
      );
      return token;
    }

    // Use SecureStore for native
    debugAuth("[Auth] Getting session token...");
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    debugAuth(
      "[Auth] Session token retrieved from SecureStore:",
      token ? `present (${token.substring(0, 20)}...)` : "missing",
    );
    return token;
  } catch (error) {
    console.error("[Auth] Failed to get session token:", error);
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    // Web: persist token fallback for Authorization header.
    if (Platform.OS === "web") {
      window.localStorage.setItem(SESSION_TOKEN_KEY, token);
      debugAuth("[Auth] Web session token stored in localStorage");
      return;
    }

    // Use SecureStore for native
    debugAuth("[Auth] Setting session token...");
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    debugAuth("[Auth] Session token stored in SecureStore successfully");
  } catch (error) {
    console.error("[Auth] Failed to set session token:", error);
    throw error;
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    // Web: clear token fallback.
    if (Platform.OS === "web") {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      debugAuth("[Auth] Web session token removed from localStorage");
      return;
    }

    // Use SecureStore for native
    debugAuth("[Auth] Removing session token...");
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    debugAuth("[Auth] Session token removed from SecureStore successfully");
  } catch (error) {
    console.error("[Auth] Failed to remove session token:", error);
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    debugAuth("[Auth] Getting user info...");

    let info: string | null = null;
    if (Platform.OS === "web") {
      // Use localStorage for web
      info = window.localStorage.getItem(USER_INFO_KEY);
    } else {
      // Use SecureStore for native
      info = await SecureStore.getItemAsync(USER_INFO_KEY);
    }

    if (!info) {
      debugAuth("[Auth] No user info found");
      return null;
    }
    const user = JSON.parse(info);
    debugAuth("[Auth] User info retrieved");
    return user;
  } catch (error) {
    console.error("[Auth] Failed to get user info:", error);
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    debugAuth("[Auth] Setting user info...");

    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      debugAuth("[Auth] User info stored in localStorage successfully");
      return;
    }

    // Use SecureStore for native
    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
    debugAuth("[Auth] User info stored in SecureStore successfully");
  } catch (error) {
    console.error("[Auth] Failed to set user info:", error);
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      // Use localStorage for web
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }

    // Use SecureStore for native
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
    console.error("[Auth] Failed to clear user info:", error);
  }
}
