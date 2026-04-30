import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { SearchClient } from "./_components/search-client";

const messages = { ja, vi };

export default async function SearchPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return <SearchClient labels={t.search} />;
}
