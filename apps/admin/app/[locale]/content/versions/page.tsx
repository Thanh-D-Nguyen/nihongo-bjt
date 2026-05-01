import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { ContentVersionsClient } from "./content-versions-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const sec =
    (((t.adminConsole as Record<string, unknown> | undefined)?.["contentVersions"] as
      | Record<string, string>
      | undefined) ??
      ((t as unknown as Record<string, unknown>)["contentVersions"] as
        | Record<string, string>
        | undefined)) ??
    {};
  return <ContentVersionsClient common={t.adminConsole.common} labels={sec} locale={locale} />;
}

