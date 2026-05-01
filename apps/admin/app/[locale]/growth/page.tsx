import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { GrowthClient } from "./growth-client";

const messages = { en, ja, vi };
type Locale = keyof typeof messages;

export default async function GrowthPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = messages[locale as Locale] ?? messages.vi;

  return <GrowthClient common={t.adminConsole.common} labels={t.growth} />;
}
