import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../components/auth/require-keycloak-auth";
import { FlashcardsClient } from "./_components/flashcards-client";

const messages = { ja, vi };

export default async function FlashcardsPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireKeycloakAuth locale={locale}>
      <FlashcardsClient labels={t.flashcards} />
    </RequireKeycloakAuth>
  );
}
