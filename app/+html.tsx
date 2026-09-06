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
        <title>EA商城｜MT4/MT5量化交易软件与策略工具 - EAXAU</title>
        <meta name="description" content="EAXAU EA商城集中展示MT4、MT5量化交易EA、指标与工具，商品页区分直接购买和咨询授权，并提供版本确认、部署支持及受控交付。" />
        <meta name="keywords" content="EA商城,EA交易软件,EA策略,量化交易,自动化交易,MT4 EA,MT5 EA,交易指标,EA授权,EAXAU" />
        <meta name="author" content="AI量化联盟" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <link rel="canonical" href="https://www.eaxau.com/" />

        {/* ===== Open Graph (社交媒体分享) ===== */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="AI量化联盟" />
        <meta property="og:title" content="EAXAU EA商城｜MT4/MT5量化交易软件与策略工具" />
        <meta property="og:description" content="浏览EA、指标与交易工具，按商品规则直接购买或咨询授权，并确认版本、部署与交付方式。" />
        <meta property="og:url" content="https://www.eaxau.com/" />
        <meta property="og:locale" content="zh_CN" />

        {/* ===== Twitter Card ===== */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="EAXAU EA商城｜MT4/MT5量化交易软件与策略工具" />
        <meta name="twitter:description" content="浏览EA、指标与交易工具，按商品规则直接购买或咨询授权。" />

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
              "description": "面向中文用户的MT4、MT5 EA、指标与量化交易工具商城，提供商品检索、授权咨询、订单结算和交付支持。",
              "inLanguage": ["zh-CN", "en", "ar"],
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
              "description": "EAXAU EA商城与AI量化联盟服务平台",
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
