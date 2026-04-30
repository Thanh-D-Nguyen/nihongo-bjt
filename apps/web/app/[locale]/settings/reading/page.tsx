import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../../components/auth/require-keycloak-auth";
import { ReadingAssistSettingsClient } from "./_components/reading-assist-settings-client";

const messages = { ja, vi };

export default async function ReadingAssistSettingsPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireKeycloakAuth locale={locale}>
      <ReadingAssistSettingsClient labels={t.readingPage} />
    </RequireKeycloakAuth>
  );
}
