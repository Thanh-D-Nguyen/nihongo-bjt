import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";

import { QuestionBankAdminClient } from "./question-bank-client";

const messages = { ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const labels = (t as Record<string, unknown>).adminConsole as Record<string, unknown>;
  const sec = (labels?.questionBank as Record<string, string>) ?? {};
  const common = (labels?.common as { empty: string; error: string; loading: string; records: string })
    ?? { empty: "Empty", error: "Error", loading: "Loading…", records: "Records" };
  return <QuestionBankAdminClient common={common} labels={sec} locale={locale} />;
}

