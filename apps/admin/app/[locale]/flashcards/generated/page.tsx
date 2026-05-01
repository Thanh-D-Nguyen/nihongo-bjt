import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { FlashcardDecksAdminClient } from "./flashcard-decks-admin-client";

const messages = { en, ja, vi };

export default async function Page({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec =
    (((t as Record<string, unknown>)["adminConsole"] as Record<string, unknown> | undefined)?.[
      "flashcardDecksManagement"
    ] as Record<string, string> | undefined) ??
    ((t as Record<string, unknown>)["flashcardDecksManagement"] as Record<string, string> | undefined) ??
    ((t as Record<string, unknown>)["flashcardDecks"] as Record<string, string> | undefined) ??
    {};
  return <FlashcardDecksAdminClient common={t.adminConsole.common} labels={sec} />;
}
