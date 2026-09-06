import { EaLibraryScreen } from "@/app/(tabs)/market";
import { V2Shell } from "@/components/v2/v2-shell";

export default function HomePage() {
  return (
    <V2Shell>
      <EaLibraryScreen variant="v2" />
    </V2Shell>
  );
}
