import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { GrowthSocialClient } from "./growth-social-client";

const messages = { ja, vi, en };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec =
    (((t.adminConsole as Record<string, unknown> | undefined)?.["growthSocial"] as
      | Record<string, string>
      | undefined) ??
      ((t as unknown as Record<string, unknown>)["growthSocial"] as
        | Record<string, string>
        | undefined)) ??
    {};
  return <GrowthSocialClient common={t.adminConsole.common} labels={sec} locale={locale} />;
}

