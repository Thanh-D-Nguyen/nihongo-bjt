import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { LifeFeedAdminClient } from "./life-feed-admin-client";

const translations = { en, ja, vi };

export default async function LifeFeedAdminPage({ params }: { params: Promise<{ locale: keyof typeof translations }> }) {
  const { locale } = await params;
  const t = translations[locale] ?? translations.vi;
  return <LifeFeedAdminClient labels={t.adminConsole.lifeFeed} />;
}
