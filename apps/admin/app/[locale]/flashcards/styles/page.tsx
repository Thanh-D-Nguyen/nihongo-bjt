import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { FlashcardStylesAdminClient } from "./flashcard-styles-admin-client";

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
      "flashcardStylesManagement"
    ] as Record<string, string> | undefined) ??
    ((t as Record<string, unknown>)["flashcardStylesManagement"] as Record<string, string> | undefined) ??
    {};
  return <FlashcardStylesAdminClient common={t.adminConsole.common} labels={sec} />;
}
