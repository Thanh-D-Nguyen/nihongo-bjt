import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { GamificationAdminClient } from "./gamification-admin-client";

const messages = { ja, vi };

export default async function AdminGamificationPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <GamificationAdminClient labels={t.gamificationAdmin} />;
}
