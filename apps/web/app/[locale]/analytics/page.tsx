import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../components/auth/require-keycloak-auth";
import { LearnerAnalyticsClient } from "./analytics-client";

const messages = { ja, vi };

export default async function LearnerAnalyticsPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireKeycloakAuth locale={locale}>
      <LearnerAnalyticsClient labels={t.analytics} locale={locale} />
    </RequireKeycloakAuth>
  );
}
