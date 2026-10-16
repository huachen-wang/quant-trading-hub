import { useIsFocused } from "@react-navigation/native";
import Head from "expo-router/head";
import { SECTION_PAGE_META } from "@/shared/seo-meta";

/**
 * 每页自己的 title / description（2026-10-17）。
 *
 * 根布局 app/_layout.tsx 的 <Head> 只是兜底；页面里的 <Head> 挂载得更晚，会覆盖兜底。
 * 只在当前页面获得焦点时渲染：Tabs 切换不会卸载旧页面，不加这个判断，
 * 回到旧标签页时标题会停在上一个页面。值与服务端预渲染同源（shared/seo-meta.ts）。
 */
export function PageHead({ title, description }: { title: string; description?: string }) {
  const focused = useIsFocused();
  if (!focused) return null;
  return (
    <Head>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
    </Head>
  );
}

/** 栏目页：按路径取 shared/seo-meta.ts 里的标题和描述。 */
export function SectionHead({ path }: { path: keyof typeof SECTION_PAGE_META & string }) {
  const meta = SECTION_PAGE_META[path];
  if (!meta) return null;
  return <PageHead title={meta.title} description={meta.description} />;
}
