import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { IamClient } from "./iam-client";

const messages = { ja, vi };

export default async function AdminIamPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <IamClient labels={t.iam} />;
}
