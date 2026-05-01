import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { LegalPolicyAdminClient } from "../_components/legal-policy-admin-client";

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

/**
 * /legal/documents — catch-all repository over all policyKey values.
 * Used for general legal-document version management; specialised surfaces
 * (consent/terms/cookies/tokushoho) ship their own focused screens.
 */
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = messages[locale as Locale] ?? messages.vi;
  const labels = pickLabels(t, "legalPolicyAdmin");
  return (
    <LegalPolicyAdminClient
      common={t.adminConsole.common}
      labels={{ ...labels, title: labels.titleDocuments ?? labels.title ?? "Legal Documents" }}
    />
  );
}
