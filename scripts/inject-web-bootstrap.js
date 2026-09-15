const fs = require("fs");
const path = require("path");

const webBuildDir = path.resolve(process.cwd(), "web-build");
const indexPath = path.join(webBuildDir, "index.html");
const marker = 'data-eaxau-bootstrap="v1"';
const strategyPreloads = [
  "/strategy-art-v2/gold-momentum.jpg",
  "/strategy-art-v2/breakout-execution.jpg",
  "/strategy-art-v2/adaptive-signal.jpg",
];
/**
 * 与 components/contact-modal.tsx 的 CONTACT_FALLBACKS 保持一致的真实联系方式。
 * 这里不能 import TS 模块，所以由 tests/noscript-fallback.test.ts 断言两边不漂移。
 * 只使用站点现有联系方式，不新增渠道。
 */
const FALLBACK_CONTACTS = {
  telegram: "@xau6000",
  telegramLink: "https://t.me/xau6000",
  wechat: "oooiniooo0624 / xau6000",
  qq: "1226426670 / 3832001817",
};

const FALLBACK_HEADLINE = "EAXAU · MT4 / MT5 EA、指标与交易工具";
const FALLBACK_BLURB =
  "页面需要 JavaScript 才能加载商品列表。版本、授权范围与交付方式由顾问确认，可直接用下面任一方式联系。";

function contactRows(idPrefix) {
  return [
    `<a class="eaxau-fallback__row" href="${FALLBACK_CONTACTS.telegramLink}" rel="noopener noreferrer" target="_blank" id="${idPrefix}-tg"><span class="eaxau-fallback__label">Telegram</span><span class="eaxau-fallback__value">${FALLBACK_CONTACTS.telegram}</span></a>`,
    `<div class="eaxau-fallback__row"><span class="eaxau-fallback__label">WeChat</span><span class="eaxau-fallback__value">${FALLBACK_CONTACTS.wechat}</span></div>`,
    `<div class="eaxau-fallback__row"><span class="eaxau-fallback__label">QQ</span><span class="eaxau-fallback__value">${FALLBACK_CONTACTS.qq}</span></div>`,
  ].join("\n      ");
}

const strategyPreloadLinks = strategyPreloads
  .map(
    (href) =>
      `    <link rel="preload" as="image" href="${href}" fetchpriority="high" ${marker}>`,
  )
  .join("\n");

const headInjection = `
${strategyPreloadLinks}
    <style ${marker}>
      html, body { margin: 0; background: #050810; }
      #eaxau-boot {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        color: #f8fafc;
        background: #050810;
        font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
      }
      #eaxau-boot[hidden] { display: none; }
      /* 服务端渲染的初始正文（#eaxau-seo）：给无 JS 访客和纯文本抓取用。
         有 JS 时被启动遮罩盖住，应用挂载后由下面的脚本整块移除，不会出现双内容。 */
      .eaxau-seo { max-width: 860px; margin: 0 auto; padding: 24px 20px 48px; color: #e2e8f0; font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.7; }
      .eaxau-seo h1 { font-size: 24px; margin: 0 0 12px; }
      .eaxau-seo h2 { font-size: 17px; margin: 24px 0 8px; }
      .eaxau-seo a { color: #d8bc83; }
      .eaxau-seo__lead { color: #cbd5f5; }
      .eaxau-seo__facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
      .eaxau-seo__facts dt { color: #94a3b8; }
      .eaxau-seo__facts dd { margin: 0; }
      .eaxau-seo__list, .eaxau-seo__contacts { padding-left: 20px; }
      .eaxau-seo__note { color: #94a3b8; font-size: 13px; }
      .eaxau-boot__brand { font-size: 28px; line-height: 1; font-weight: 900; letter-spacing: 0; }
      .eaxau-boot__track { width: 104px; height: 2px; overflow: hidden; background: rgba(148, 163, 184, 0.22); }
      .eaxau-boot__track::after {
        content: "";
        display: block;
        width: 42%;
        height: 100%;
        background: #d8bc83;
        animation: eaxau-boot-progress 1.1s ease-in-out infinite;
      }
      .eaxau-boot__status { color: rgba(148, 163, 184, 0.86); font-size: 11px; font-weight: 700; letter-spacing: 0; }
      @keyframes eaxau-boot-progress {
        from { transform: translateX(-115%); }
        to { transform: translateX(250%); }
      }
      @media (prefers-reduced-motion: reduce) {
        .eaxau-boot__track::after { animation-duration: 2.4s; }
      }
      .eaxau-fallback {
        width: 100%;
        max-width: 420px;
        margin: 0 auto;
        padding: 18px;
        box-sizing: border-box;
        border: 1px solid rgba(216, 188, 131, 0.42);
        background: rgba(216, 188, 131, 0.06);
        color: #f8fafc;
        font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
        text-align: left;
      }
      .eaxau-fallback[hidden] { display: none; }
      .eaxau-fallback__title { margin: 0 0 8px; font-size: 15px; font-weight: 800; color: #d8bc83; }
      .eaxau-fallback__blurb { margin: 0 0 14px; font-size: 12px; line-height: 19px; color: rgba(148, 163, 184, 0.94); }
      .eaxau-fallback__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 40px;
        margin-bottom: 6px;
        padding: 0 10px;
        border: 1px solid rgba(148, 163, 184, 0.28);
        background: rgba(13, 21, 33, 0.86);
        color: #f4f7fb;
        text-decoration: none;
      }
      .eaxau-fallback__label { font-size: 10px; font-weight: 800; color: rgba(148, 163, 184, 0.9); }
      .eaxau-fallback__value { font-size: 13px; font-weight: 800; word-break: break-all; }
      .eaxau-fallback__note { margin: 10px 0 0; font-size: 10px; line-height: 16px; color: rgba(148, 163, 184, 0.78); }
      .eaxau-noscript { display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; background: #050810; }
    </style>
    <script ${marker}>
      (function () {
        var retryKey = "eaxau:asset-retry:v1";

        function retryLatestBuild() {
          try {
            if (window.sessionStorage.getItem(retryKey)) return;
            window.sessionStorage.setItem(retryKey, "1");
          } catch (_) {}

          var nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set("_asset_retry", Date.now().toString());
          window.location.replace(nextUrl.toString());
        }

        window.addEventListener("error", function (event) {
          var target = event.target;
          if (
            target &&
            target.tagName === "SCRIPT" &&
            typeof target.src === "string" &&
            target.src.indexOf("/_expo/static/js/") !== -1
          ) {
            retryLatestBuild();
          }
        }, true);

        document.addEventListener("DOMContentLoaded", function () {
          var boot = document.getElementById("eaxau-boot");
          var root = document.getElementById("root");
          var observer;

          function rootHasVisibleContent() {
            if (!root) return false;

            var text = (root.textContent || "").replace(/\\s+/g, "");
            if (text.length > 0) return true;

            var visual = root.querySelector(
              'img, svg, canvas, video, input, button, [role="img"], [aria-label]',
            );
            if (!visual || typeof visual.getBoundingClientRect !== "function") {
              return false;
            }

            var rect = visual.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }

          function dismissWhenReady() {
            if (!boot || !rootHasVisibleContent()) return false;
            boot.hidden = true;
            /* 应用已经挂载：移走服务端渲染的初始正文，避免同页出现两份内容。 */
            var seo = document.getElementById("eaxau-seo");
            if (seo && seo.parentNode) seo.parentNode.removeChild(seo);
            if (observer) observer.disconnect();
            try { window.sessionStorage.removeItem(retryKey); } catch (_) {}
            return true;
          }

          if (dismissWhenReady()) return;
          if (root && window.MutationObserver) {
            observer = new MutationObserver(dismissWhenReady);
            observer.observe(root, {
              childList: true,
              characterData: true,
              subtree: true,
            });
          }

          window.setTimeout(function () {
            var status = document.querySelector(".eaxau-boot__status");
            if (status && !dismissWhenReady()) status.textContent = "正在重新连接";
          }, 8000);

          // 重试后仍然没挂载：不要把人留在无限"正在连接"上，露出真实联系方式。
          window.setTimeout(function () {
            if (dismissWhenReady()) return;
            var fallback = document.getElementById("eaxau-boot-fallback");
            if (fallback) fallback.hidden = false;
            var status = document.querySelector(".eaxau-boot__status");
            if (status) status.textContent = "加载失败";
          }, 14000);
        }, { once: true });
      })();
    </script>`;

const bodyInjection = `
    <div id="eaxau-boot" role="status" aria-live="polite">
      <div class="eaxau-boot__brand">EAXAU</div>
      <div class="eaxau-boot__track" aria-hidden="true"></div>
      <div class="eaxau-boot__status">正在连接</div>
      <div class="eaxau-fallback" id="eaxau-boot-fallback" hidden>
        <p class="eaxau-fallback__title">${FALLBACK_HEADLINE}</p>
        <p class="eaxau-fallback__blurb">${FALLBACK_BLURB.replace("页面需要 JavaScript 才能加载商品列表。", "商品列表这次没能加载出来。")}</p>
      ${contactRows("eaxau-boot-fallback")}
        <p class="eaxau-fallback__note">咨询时请附上商品名称或商品页地址，顾问会确认版本、授权范围与交付方式。</p>
      </div>
    </div>`;

/** 替换 Expo 导出的出厂 noscript（"You need to enable JavaScript to run this app."）。 */
const noscriptInjection = `<noscript ${marker}>
    <style>#eaxau-boot { display: none !important; } body { overflow: auto !important; }</style>
    <div class="eaxau-noscript">
      <div class="eaxau-fallback">
        <p class="eaxau-fallback__title">${FALLBACK_HEADLINE}</p>
        <p class="eaxau-fallback__blurb">${FALLBACK_BLURB}</p>
      ${contactRows("eaxau-noscript")}
        <p class="eaxau-fallback__note">咨询时请附上商品名称或商品页地址，顾问会确认版本、授权范围与交付方式。</p>
      </div>
    </div>
  </noscript>`;

function main() {
  if (!fs.existsSync(indexPath)) {
    throw new Error("web-build/index.html was not generated");
  }

  let indexHtml = fs.readFileSync(indexPath, "utf8");
  if (indexHtml.includes(marker)) {
    console.log("[inject-web-bootstrap] bootstrap already present");
    return;
  }
  if (!indexHtml.includes("</head>") || !/<body(?:\s[^>]*)?>/.test(indexHtml)) {
    throw new Error(
      "web-build/index.html has an unexpected document structure",
    );
  }

  const factoryNoscript = /<noscript>[\s\S]*?<\/noscript>/;
  const hadFactoryNoscript = factoryNoscript.test(indexHtml);

  indexHtml = indexHtml
    .replace("</head>", `${headInjection}\n  </head>`)
    .replace(/<body(\s[^>]*)?>/, (bodyTag) => `${bodyTag}${bodyInjection}`);

  indexHtml = hadFactoryNoscript
    ? indexHtml.replace(factoryNoscript, noscriptInjection)
    : indexHtml.replace(/<body(\s[^>]*)?>/, (bodyTag) => `${bodyTag}\n    ${noscriptInjection}`);

  if (!indexHtml.includes("eaxau-noscript")) {
    throw new Error("failed to install the no-JavaScript contact fallback");
  }
  if (/You need to enable JavaScript to run this app/.test(indexHtml)) {
    throw new Error("factory noscript copy is still present in web-build/index.html");
  }

  fs.writeFileSync(indexPath, indexHtml);
  console.log(
    `[inject-web-bootstrap] added loading recovery, no-JS contact fallback (${hadFactoryNoscript ? "replaced factory noscript" : "injected"}) and ${strategyPreloads.length} image preload(s)`,
  );
}

main();
