import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { LotoLabAdminClient } from "./_components/loto-lab-admin-client";

const messages = { ja, vi, en };

export default async function AdminLotoLabPage({
  params,
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <LotoLabAdminClient labels={t.magazine} lotoLabels={t.lotoLab} locale={locale} />;
}
