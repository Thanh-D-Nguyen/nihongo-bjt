import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AuditClient } from "./audit-client";

const messages = { en, ja, vi };
type Locale = keyof typeof messages;

export default async function AdminAuditPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = messages[locale as Locale] ?? messages.vi;

  return <AuditClient common={t.adminConsole.common} labels={t.audit} />;
}
