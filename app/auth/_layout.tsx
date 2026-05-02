import { Stack } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function AuthLayout() {
  return (
    <ScreenContainer>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </ScreenContainer>
  );
}
