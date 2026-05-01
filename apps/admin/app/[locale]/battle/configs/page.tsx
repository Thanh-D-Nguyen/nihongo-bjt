import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { BattleConfigsClient } from "./battle-configs-client";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec =
    ((t.adminConsole as Record<string, unknown> | undefined)?.["battleConfigs"] as
      | Record<string, string>
      | undefined) ?? {};
  return (
    <BattleConfigsClient
      common={t.adminConsole.common}
      labels={sec as unknown as Record<string, string>}
      locale={locale}
    />
  );
}
