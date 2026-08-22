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
        }, { once: true });
      })();
    </script>`;

const bodyInjection = `
    <div id="eaxau-boot" role="status" aria-live="polite">
      <div class="eaxau-boot__brand">EAXAU</div>
      <div class="eaxau-boot__track" aria-hidden="true"></div>
      <div class="eaxau-boot__status">正在连接</div>
    </div>`;

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

  indexHtml = indexHtml
    .replace("</head>", `${headInjection}\n  </head>`)
    .replace(/<body(\s[^>]*)?>/, (bodyTag) => `${bodyTag}${bodyInjection}`);

  fs.writeFileSync(indexPath, indexHtml);
  console.log(
    `[inject-web-bootstrap] added loading recovery and ${strategyPreloads.length} image preload(s)`,
  );
}

main();
