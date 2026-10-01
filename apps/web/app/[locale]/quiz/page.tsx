import type { Metadata } from "next";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireAuth } from "../../../components/auth/require-auth";
import { QuizClient } from "./_components/quiz-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.quiz.title} — KotobaWorks` };
}

export default async function QuizPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireAuth locale={locale}>
      <QuizClient labels={t.quiz} locale={locale} />
    </RequireAuth>
  );
}
