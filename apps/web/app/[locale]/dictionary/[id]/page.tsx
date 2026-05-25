import type { Metadata } from "next";
import vi from "../../../../messages/vi.json";
import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import { LexemeDetailClient } from "./_components/lexeme-detail-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.dictionary.title} — NihonGo BJT` };
}

export default async function LexemeDetailPage({
  params
}: {
  params: Promise<{ id: string; locale: keyof typeof messages }>;
}) {
  const { id, locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <LexemeDetailClient
      actionLabels={t.contentActions}
      id={id}
      labels={t.dictionaryDetail}
      locale={locale}
      readingAssistLabels={t.quiz.readingAssist.annotated}
    />
  );
}
