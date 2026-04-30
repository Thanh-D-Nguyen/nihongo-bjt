import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { AuditClient } from "./audit-client";

const messages = { ja, vi };

export default async function AdminAuditPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <AuditClient labels={t.audit} />;
}
