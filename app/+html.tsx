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
