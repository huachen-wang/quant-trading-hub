# Admin Login Bug Analysis

## Root Cause
The admin login button IS working (onClick handler is bound), but the problem is:

1. **Admin _layout.tsx** calls `useAuth()` which on web platform calls `getMe()` API
2. `getMe()` calls `/api/auth/me` which fails with 403 (Missing session cookie) 
3. This is expected - no user is logged in via OAuth
4. After `useAuth` loading finishes, `loading=false`, `isAuthenticated=false`, `user=null`
5. The layout effect then checks: `if (!loading && (!isAuthenticated || user?.role !== "admin"))` → redirects to login
6. This works correctly - user sees the login page

## The Real Problem
When user clicks "登录" button:
- `handleLogin` sets `admin_logged_in=true` in AsyncStorage
- Then calls `router.replace("/admin")`
- BUT: `admin _layout.tsx` only reads `admin_logged_in` ONCE in useEffect on mount
- The `adminLoggedIn` state doesn't update when AsyncStorage changes
- So when navigating to /admin, the layout still thinks adminLoggedIn=false
- It immediately redirects back to /admin/login

## Fix
Need to either:
a) Make admin _layout.tsx re-check adminLoggedIn after navigation
b) Use a simpler approach - bypass the OAuth check entirely for admin login
c) Use a global state/event to notify the layout that admin has logged in
