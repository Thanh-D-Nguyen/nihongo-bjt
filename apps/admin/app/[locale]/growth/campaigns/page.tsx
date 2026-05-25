import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { GrowthCampaignsClient } from "./growth-campaigns-client";

const messages = { ja, vi, en };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec =
    (((t.adminConsole as Record<string, unknown> | undefined)?.["growthCampaigns"] as
      | Record<string, string>
      | undefined) ??
      ((t as unknown as Record<string, unknown>)["growthCampaigns"] as
        | Record<string, string>
        | undefined)) ??
    {};
  return <GrowthCampaignsClient common={t.adminConsole.common} labels={sec} locale={locale} />;
}

