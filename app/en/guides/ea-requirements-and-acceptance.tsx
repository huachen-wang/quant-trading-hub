import { ContentArticlePage } from "@/components/content/content-article-page";
import { GUIDE_EN_PATH } from "@/shared/content-pages";

/** /en/guides/ea-requirements-and-acceptance：C04 指南英文版（2026-10-18）。正文与预渲染同源：shared/content-pages。 */
export default function EaRequirementsGuideEnglishPage() {
  return <ContentArticlePage path={GUIDE_EN_PATH} />;
}
