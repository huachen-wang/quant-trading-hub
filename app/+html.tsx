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
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' https: wss:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests"
        />

        {/* ===== SEO Core Meta Tags ===== */}
        <title>AI量化联盟 | 六策略资管与EA商城</title>
        <meta name="description" content="AI量化联盟（eaxau.com）提供六款量化策略展示与资管接入选配，并为EA文件提供独立USDT订单结算。资管入金与EA销售款严格分账。" />
        <meta name="keywords" content="AI量化联盟,量化交易,EA策略,MT4,MT5,六策略,资管接入,USDT结算,eaxau" />
        <meta name="author" content="AI量化联盟" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <link rel="canonical" href="https://www.eaxau.com/" />

        {/* ===== Open Graph (社交媒体分享) ===== */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AI量化联盟" />
        <meta property="og:title" content="AI量化联盟 | 六策略资管与EA商城" />
        <meta property="og:description" content="六策略资管接入选配、可选券商通道与独立EA商城USDT订单结算。" />
        <meta property="og:url" content="https://www.eaxau.com/" />
        <meta property="og:locale" content="zh_CN" />

        {/* ===== Twitter Card ===== */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="AI量化联盟 | 六策略资管与EA商城" />
        <meta name="twitter:description" content="六策略资管接入选配与EA商城USDT订单结算。" />

        {/* ===== Mobile App Meta ===== */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="AI量化联盟" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#10B981" />
        <meta name="application-name" content="AI量化联盟" />

        {/* ===== JSON-LD Structured Data ===== */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "AI量化联盟",
              "alternateName": "eaxau.com",
              "url": "https://www.eaxau.com",
              "description": "六策略资管接入选配与EA商城USDT独立订单结算平台。",
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
              "name": "AI量化联盟",
              "url": "https://www.eaxau.com",
              "description": "六策略资管与EA商城平台",
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
