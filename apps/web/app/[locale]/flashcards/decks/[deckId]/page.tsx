import type { Metadata } from "next";
import ja from "../../../../../messages/ja.json";
import vi from "../../../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../../../components/auth/require-keycloak-auth";
import { DeckDetailClient } from "../../_components/deck-detail-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.decks.deckDetailPageTitle} — NihonGo BJT` };
}

export default async function DeckDetailPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages; deckId: string }>;
}) {
  const { locale, deckId } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireKeycloakAuth locale={locale}>
      <DeckDetailClient deckId={deckId} labels={t.decks} locale={locale} />
    </RequireKeycloakAuth>
  );
}
