import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";

import { QuizSessionsAdminClient } from "./quiz-sessions-client";

const messages = { ja, vi, en };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const labels = (t as Record<string, unknown>).adminConsole as Record<string, unknown>;
  const sec = (labels?.quizSessions as Record<string, string>) ?? {};
  const common = (labels?.common as { empty: string; error: string; loading: string; records: string })
    ?? { empty: "Empty", error: "Error", loading: "Loading…", records: "Records" };
  return <QuizSessionsAdminClient common={common} labels={sec} locale={locale} />;
}

