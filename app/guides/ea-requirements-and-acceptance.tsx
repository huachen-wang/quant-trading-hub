import { ContentArticlePage } from "@/components/content/content-article-page";
import { GUIDE_ZH_PATH } from "@/shared/content-pages";

/** /guides/ea-requirements-and-acceptance：C04 需求与验收指南（2026-10-18）。正文与预渲染同源：shared/content-pages。 */
export default function EaRequirementsGuidePage() {
  return <ContentArticlePage path={GUIDE_ZH_PATH} />;
}
