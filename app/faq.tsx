import { ContentArticlePage } from "@/components/content/content-article-page";
import { FAQ_ZH_PATH } from "@/shared/content-pages";

/** /faq：常见问题（2026-10-18）。正文与预渲染、FAQPage 结构化数据同源：shared/content-pages/faq.ts。 */
export default function FaqPage() {
  return <ContentArticlePage path={FAQ_ZH_PATH} />;
}
