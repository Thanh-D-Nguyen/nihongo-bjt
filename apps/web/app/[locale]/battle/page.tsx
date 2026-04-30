import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../components/auth/require-keycloak-auth";
import { BattleClient } from "./_components/battle-client";

const messages = { ja, vi };

export default async function BattlePage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireKeycloakAuth locale={locale}>
      <BattleClient labels={t.battle} />
    </RequireKeycloakAuth>
  );
}
