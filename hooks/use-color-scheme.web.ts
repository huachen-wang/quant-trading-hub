import { useThemeContext } from "@/lib/theme-provider";

/**
 * Web-specific hook: always reads from ThemeProvider context
 * to ensure the app's forced dark mode is respected,
 * regardless of the browser's system color scheme preference.
 */
export function useColorScheme() {
  return useThemeContext().colorScheme;
}
