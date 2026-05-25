import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../components/auth/require-keycloak-auth";
import { OnboardingClient } from "./_components/onboarding-client";

const messages = { ja, vi, en };

export default async function OnboardingPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireKeycloakAuth locale={locale}>
      <OnboardingClient labels={t.onboarding} />
    </RequireKeycloakAuth>
  );
}
