import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Custom HTML template for Expo Router web export.
 * Overrides the default ScrollViewStyleReset to remove body overflow:hidden,
 * which prevents scrolling on mobile browsers.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>量化军火库</title>
        <meta name="description" content="MT4/MT5量化交易策略分享、评分和实盘数据展示平台" />
        {/*
          Custom style reset: keep full-height layout but allow body scrolling.
          The default Expo ScrollViewStyleReset sets body { overflow: hidden }
          which prevents page scrolling on mobile browsers.
          We override it to use overflow: auto instead.
        */}
        <style
          id="expo-reset"
          dangerouslySetInnerHTML={{
            __html: `
              html, body { height: 100%; margin: 0; padding: 0; }
              body { overflow: auto; -webkit-overflow-scrolling: touch; }
              #root { display: flex; height: 100%; flex: 1; }
            `,
          }}
        />
        {/* Safe area padding for iOS Safari bottom bar */}
        <style
          id="safe-area-fix"
          dangerouslySetInnerHTML={{
            __html: `
              /* iOS Safari safe area support */
              @supports (padding-bottom: env(safe-area-inset-bottom)) {
                body {
                  padding-bottom: env(safe-area-inset-bottom);
                }
              }
              /* Smooth scrolling */
              html { scroll-behavior: smooth; }
              /* Prevent pull-to-refresh on Chrome mobile */
              body { overscroll-behavior-y: contain; }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
