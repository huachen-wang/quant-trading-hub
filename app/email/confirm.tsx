import { useLocalSearchParams } from "expo-router";
import { EmailPreferencePage } from "@/components/email-preference-page";
import { trpc } from "@/lib/trpc";

export default function ConfirmEmailSubscriptionPage() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const value = typeof token === "string" ? token : "";
  const mutation = trpc.subscriptions.confirmEmail.useMutation();
  return (
    <EmailPreferencePage
      mode="confirm"
      tokenValid={/^[A-Za-z0-9_-]{43}$/u.test(value)}
      onSubmit={() => mutation.mutateAsync({ token: value })}
    />
  );
}
