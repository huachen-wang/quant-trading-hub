import { Slot } from "expo-router";
import { V2Shell } from "@/components/v2/v2-shell";

export default function V2PreviewLayout() {
  return (
    <V2Shell>
      <Slot />
    </V2Shell>
  );
}
