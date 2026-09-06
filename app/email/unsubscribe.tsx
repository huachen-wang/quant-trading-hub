import { useLocalSearchParams } from "expo-router";
import { EmailPreferencePage } from "@/components/email-preference-page";
import { trpc } from "@/lib/trpc";

export default function UnsubscribeEmailPage() {
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const value = typeof token === "string" ? token : "";
  const mutation = trpc.subscriptions.unsubscribeEmail.useMutation();
  return (
    <EmailPreferencePage
      mode="unsubscribe"
      tokenValid={/^\d+\.\d+\.[A-Za-z0-9_-]{43}$/u.test(value)}
      onSubmit={() => mutation.mutateAsync({ token: value })}
    />
  );
}
