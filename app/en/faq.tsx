import { ContentArticlePage } from "@/components/content/content-article-page";
import { FAQ_EN_PATH } from "@/shared/content-pages";

/** /en/faq：常见问题英文版（2026-10-18）。正文与预渲染、FAQPage 结构化数据同源：shared/content-pages/faq.ts。 */
export default function FaqEnglishPage() {
  return <ContentArticlePage path={FAQ_EN_PATH} />;
}
