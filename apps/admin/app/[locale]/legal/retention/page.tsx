import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { LegalRetentionAdminClient } from "./legal-retention-admin-client";

const messages = { en, ja, vi };
type Locale = keyof typeof messages;

function pickLabels(t: unknown, key: string): Record<string, string> {
  const root = t as Record<string, unknown>;
  const fromAdminConsole = (root.adminConsole as Record<string, unknown> | undefined)?.[key] as
    | Record<string, string>
    | undefined;
  const fromTopLevel = root[key] as Record<string, string> | undefined;
  return { ...(fromTopLevel ?? {}), ...(fromAdminConsole ?? {}) };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = messages[locale as Locale] ?? messages.vi;
  const labels = pickLabels(t, "legalRetentionAdmin");
  return (
    <LegalRetentionAdminClient
      common={t.adminConsole.common}
      labels={labels}
    />
  );
}
