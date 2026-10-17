import { useIsFocused } from "@react-navigation/native";
import { usePathname } from "expo-router";
import Head from "expo-router/head";
import { useEffect, type ReactElement } from "react";
import { serverHeadHandoff, useServerHeadActive } from "@/lib/route-head";
import { SECTION_PAGE_META } from "@/shared/seo-meta";
import { sectionHeadTags, type HeadTag } from "@/shared/seo-head";

/**
 * 每页自己的头部（2026-10-17 起 title / description；2026-10-18 起 canonical、robots、hreflang、OG、JSON-LD）。
 *
 * 根布局 app/_layout.tsx 的 <Head> 只是兜底；页面里的 <Head> 挂载得更晚，会覆盖兜底。
 * 只在当前页面获得焦点时渲染：Tabs 切换不会卸载旧页面，不加这个判断，
 * 回到旧标签页时标题会停在上一个页面。值与服务端预渲染同源（shared/seo-meta.ts、shared/seo-head.ts）。
 *
 * `tags`（canonical 等）只在服务端首屏标签已经交接之后才输出（见 lib/route-head.ts）：
 * 还停在首屏那一页时，服务端已经写好了同样的标签，再输出一遍就重复了。
 */
export function PageHead({ title, description, tags }: { title: string; description?: string; tags?: HeadTag[] }) {
  const focused = useIsFocused();
  const serverHeadActive = useServerHeadActive();
  if (!focused) return null;
  return (
    <Head>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      {!serverHeadActive && tags ? tags.map(renderHeadTag) : null}
    </Head>
  );
}

function renderHeadTag(tag: HeadTag, index: number): ReactElement {
  switch (tag.kind) {
    case "link":
      return tag.hreflang ? (
        <link key={index} rel={tag.rel} hrefLang={tag.hreflang} href={tag.href} />
      ) : (
        <link key={index} rel={tag.rel} href={tag.href} />
      );
    case "meta":
      return <meta key={index} name={tag.name} content={tag.content} />;
    case "property":
      return <meta key={index} property={tag.property} content={tag.content} />;
    case "jsonld":
      return (
        <script key={index} type="application/ld+json">
          {tag.json}
        </script>
      );
  }
}

/** 栏目页：按路径取 shared/seo-meta.ts 里的标题和描述，shared/seo-head.ts 里的头部标签。 */
export function SectionHead({ path }: { path: keyof typeof SECTION_PAGE_META & string }) {
  const meta = SECTION_PAGE_META[path];
  if (!meta) return null;
  return <PageHead title={meta.title} description={meta.description} tags={sectionHeadTags(path)} />;
}

/**
 * 挂在根布局里：路由一变就通知交接。离开首屏地址时移除服务端写的那批头部标签，
 * 之后由当前页面的 <PageHead> 接管；没有 <PageHead> 的页面就不再带着上一页的 canonical / noindex。
 */
export function RouteHeadHandoff() {
  const pathname = usePathname();
  useEffect(() => {
    serverHeadHandoff.onRouteChange(pathname);
  }, [pathname]);
  return null;
}
