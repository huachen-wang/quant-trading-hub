import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * Custom HTML template for Expo Router web export.
 * Overrides the default ScrollViewStyleReset to remove body overflow:hidden,
 * which prevents scrolling on mobile browsers.
 *
 * Enhanced with comprehensive SEO meta tags, Open Graph, and structured data.
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

        {/* ===== SEO Core Meta Tags ===== */}
        <title>量化军火库 | 专业EA策略展示与量化交易合作平台</title>
        <meta name="description" content="量化军火库（eaxau.com）是专业的MT4/MT5 EA策略展示与筛选平台，提供精选量化交易策略的实盘数据、权益曲线和回测报告。同时帮助交易者匹配最适合的合规交易环境，提供策略筛选、平台对接、技术支持等一站式服务。" />
        <meta name="keywords" content="量化交易,EA策略,MT4,MT5,外汇EA,量化军火库,自动化交易,EA展示,量化合作,交易策略,实盘数据,权益曲线,eaxau" />
        <meta name="author" content="量化军火库" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <link rel="canonical" href="https://www.eaxau.com/" />

        {/* ===== Open Graph (社交媒体分享) ===== */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="量化军火库" />
        <meta property="og:title" content="量化军火库 | 专业EA策略展示与量化交易合作平台" />
        <meta property="og:description" content="精选MT4/MT5 EA策略展示，实盘数据透明可查。帮助交易者筛选优质策略、匹配合规交易平台，提供一站式量化交易服务。" />
        <meta property="og:url" content="https://www.eaxau.com/" />
        <meta property="og:locale" content="zh_CN" />

        {/* ===== Twitter Card ===== */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="量化军火库 | 专业EA策略展示与量化交易合作平台" />
        <meta name="twitter:description" content="精选MT4/MT5 EA策略展示，实盘数据透明可查。策略筛选+平台匹配，一站式量化交易服务。" />

        {/* ===== Mobile App Meta ===== */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="量化军火库" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#10B981" />
        <meta name="application-name" content="量化军火库" />

        {/* ===== JSON-LD Structured Data ===== */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "量化军火库",
              "alternateName": "eaxau",
              "url": "https://www.eaxau.com",
              "description": "专业的MT4/MT5 EA策略展示平台，提供精选量化交易策略的实盘数据展示，促成工作室合作。",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.eaxau.com/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "量化军火库",
              "url": "https://www.eaxau.com",
              "description": "专业EA策略展示与量化交易合作平台",
              "sameAs": []
            }),
          }}
        />

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
              html, body { height: 100%; margin: 0; padding: 0; background-color: #050810; }
              body { overflow: auto; -webkit-overflow-scrolling: touch; background-color: #050810; }
              #root { display: flex; height: 100%; flex: 1; background-color: #050810; }
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
        {/* Crypto polyfill for browsers that don't support Web Crypto API */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Ensure crypto object exists on both globalThis and window
                if (typeof globalThis.crypto === 'undefined') {
                  globalThis.crypto = {};
                }
                if (typeof window !== 'undefined' && typeof window.crypto === 'undefined') {
                  window.crypto = globalThis.crypto;
                }
                
                // Polyfill crypto.randomUUID
                if (typeof globalThis.crypto.randomUUID !== 'function') {
                  globalThis.crypto.randomUUID = function() {
                    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                      var r = Math.random() * 16 | 0;
                      var v = c === 'x' ? r : (r & 0x3 | 0x8);
                      return v.toString(16);
                    });
                  };
                }
                
                // Polyfill crypto.getRandomValues
                if (typeof globalThis.crypto.getRandomValues !== 'function') {
                  globalThis.crypto.getRandomValues = function(arr) {
                    for (var i = 0; i < arr.length; i++) {
                      arr[i] = Math.floor(Math.random() * 256);
                    }
                    return arr;
                  };
                }
                
                // Polyfill crypto.subtle for jose library
                if (typeof globalThis.crypto.subtle === 'undefined') {
                  console.warn('[Crypto Polyfill] crypto.subtle is not available in this browser. Admin login may not work.');
                  // Create a minimal stub to prevent "crypto is not defined" error
                  globalThis.crypto.subtle = {
                    sign: function() { return Promise.reject(new Error('crypto.subtle.sign not supported')); },
                    verify: function() { return Promise.reject(new Error('crypto.subtle.verify not supported')); },
                    encrypt: function() { return Promise.reject(new Error('crypto.subtle.encrypt not supported')); },
                    decrypt: function() { return Promise.reject(new Error('crypto.subtle.decrypt not supported')); },
                    digest: function() { return Promise.reject(new Error('crypto.subtle.digest not supported')); },
                    generateKey: function() { return Promise.reject(new Error('crypto.subtle.generateKey not supported')); },
                    deriveKey: function() { return Promise.reject(new Error('crypto.subtle.deriveKey not supported')); },
                    deriveBits: function() { return Promise.reject(new Error('crypto.subtle.deriveBits not supported')); },
                    importKey: function() { return Promise.reject(new Error('crypto.subtle.importKey not supported')); },
                    exportKey: function() { return Promise.reject(new Error('crypto.subtle.exportKey not supported')); },
                    wrapKey: function() { return Promise.reject(new Error('crypto.subtle.wrapKey not supported')); },
                    unwrapKey: function() { return Promise.reject(new Error('crypto.subtle.unwrapKey not supported')); }
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
