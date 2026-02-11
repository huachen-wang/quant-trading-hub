# Debug Findings - TWO ISSUES FOUND

## Issue 1: API URL is WRONG (web-build is stale)
The login request goes to:
`https://3000-iu1hdnko3k78ui9f6dfdt-15bd6fe8.sg1.manus.computer/api/trpc/adminAuth.login`

This is the Manus sandbox dev server, NOT eaxau.com!

This means the web-build deployed to Railway still contains the OLD code where
getApiBaseUrl() was hardcoded or compiled with the dev server URL.

The EXPO_PUBLIC_API_BASE_URL env var is set on Railway, but the web-build was
compiled WITHOUT this env var (it was built in the sandbox where the env var doesn't exist).

FIX: Need to set EXPO_PUBLIC_API_BASE_URL=https://eaxau.com in the sandbox .env
BEFORE running `npx expo export`, so the value gets baked into the static build.

## Issue 2: Password mismatch
Even if the URL were correct, the response is 401 "邮箱或密码错误".
This means either:
- ADMIN_PASSWORD on Railway is not "5201314Yzn@@"
- Or the admin-auth.ts comparison logic has a bug

The response came from the sandbox server (not Railway), so the sandbox has
ADMIN_PASSWORD set to something else (probably the old value).

## Fix Plan
1. Set EXPO_PUBLIC_API_BASE_URL=https://eaxau.com in sandbox .env
2. Rebuild web-build with `npx expo export`
3. Push to GitHub → Railway auto-deploys
4. Verify on eaxau.com
