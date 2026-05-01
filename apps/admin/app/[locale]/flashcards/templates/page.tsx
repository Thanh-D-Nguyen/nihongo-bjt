import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { FlashcardVariantsAdminClient } from "./flashcard-variants-admin-client";

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
      "flashcardTemplatesManagement"
    ] as Record<string, string> | undefined) ??
    ((t as Record<string, unknown>)["flashcardTemplatesManagement"] as Record<string, string> | undefined) ??
    ((t as Record<string, unknown>)["flashcardTemplates"] as Record<string, string> | undefined) ??
    {};
  return <FlashcardVariantsAdminClient common={t.adminConsole.common} labels={sec} />;
}
