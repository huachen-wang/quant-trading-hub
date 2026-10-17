import { Slot } from "expo-router";
import { PageHead } from "@/components/page-head";
import { V2Shell } from "@/components/v2/v2-shell";
import { noindexPageTitle } from "@/shared/seo-meta";
import { noindexHeadTags } from "@/shared/seo-head";

export default function V2PreviewLayout() {
  return (
    <V2Shell>
      {/* 预览页不收录：服务端首屏已经写了 noindex；站内跳进来时由这里给出（2026-10-18，R3 ⑦）。 */}
      <PageHead title={noindexPageTitle("/v2-preview") ?? "EAXAU"} tags={noindexHeadTags()} />
      <Slot />
    </V2Shell>
  );
}
