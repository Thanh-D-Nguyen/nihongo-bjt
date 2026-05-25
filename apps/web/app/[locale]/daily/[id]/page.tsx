import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { DailyDetailClient } from "./daily-detail-client";

const messages = { ja, vi, en };

export default async function DailyItemPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages; id: string }>;
}) {
  const { locale, id } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <DailyDetailClient
      dailyLabels={t.daily}
      detailLabels={t.dailyDetail}
      id={id}
      locale={locale}
      readingAssistLabels={t.quiz.readingAssist.annotated}
    />
  );
}
