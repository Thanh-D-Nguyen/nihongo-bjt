import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { MediaAdminClient } from "./media-admin-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels =
    ((t.mediaLibrary as Record<string, unknown>).library as Record<string, string> | undefined) ??
    ((vi.mediaLibrary as Record<string, unknown>).library as Record<string, string>);
  const common = t.adminConsole.common;
  return <MediaAdminClient common={common} labels={labels} locale={locale} />;
}

