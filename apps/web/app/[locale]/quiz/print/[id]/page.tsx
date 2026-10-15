import type { Metadata } from "next";

import en from "../../../../../messages/en.json";
import ja from "../../../../../messages/ja.json";
import vi from "../../../../../messages/vi.json";
import { PrintExamClient } from "./_components/print-exam-client";

const messages = { en, ja, vi };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale as keyof typeof messages] ?? vi;
  return { title: `${t.quiz.print.printButton} — KotobaWorks`, robots: "noindex" };
}

export default async function PrintExamPage({
  params
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = messages[locale as keyof typeof messages] ?? vi;
  return <PrintExamClient examId={id} labels={t.quiz} locale={locale} />;
}
