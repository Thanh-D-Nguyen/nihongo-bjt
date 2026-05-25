import type { Metadata } from "next";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../components/auth/require-keycloak-auth";
import { BattleLobbyClient } from "./_components/battle-lobby-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.battle.title} — NihonGo BJT` };
}

export default async function BattlePage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;

  return (
    <RequireKeycloakAuth locale={locale}>
      <BattleLobbyClient />
    </RequireKeycloakAuth>
  );
}
