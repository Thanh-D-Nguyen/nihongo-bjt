import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { CardgenAdminClient } from "./cardgen-admin-client";

const messages = { ja, vi, en };

export default async function AdminCardgenPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <CardgenAdminClient labels={t.cardgenAdmin} />;
}
