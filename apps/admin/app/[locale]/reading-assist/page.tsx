import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { ReadingAssistAdminClient } from "./reading-assist-client";

const messages = { ja, vi };

export default async function ReadingAssistAdminPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <ReadingAssistAdminClient labels={t.readingAssist} />;
}
