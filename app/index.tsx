import { EaLibraryScreen } from "@/app/(tabs)/market";
import { V2Shell } from "@/components/v2/v2-shell";
import { SectionHead } from "@/components/page-head";

export default function HomePage() {
  return (
    <V2Shell>
      <SectionHead path="/" />
      <EaLibraryScreen variant="v2" />
    </V2Shell>
  );
}
