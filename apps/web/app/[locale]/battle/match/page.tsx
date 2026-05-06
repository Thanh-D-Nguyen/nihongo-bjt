import type { Metadata } from "next";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../../components/auth/require-keycloak-auth";
import { BattleMatchClient } from "../_components/battle-match-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.battle.matchDocumentTitle} — NihonGo BJT` };
}

export default async function BattleMatchPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;

  return (
    <RequireKeycloakAuth locale={locale}>
      <BattleMatchClient />
    </RequireKeycloakAuth>
  );
}
