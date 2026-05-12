import type { Metadata } from "next";
import vi from "../../../../../../messages/vi.json";
import ja from "../../../../../../messages/ja.json";
import { LessonDetailClient } from "./_components/lesson-detail-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.lessonDetail.pageTitle} — NihonGo BJT` };
}

export default async function LessonDetailPage({
  params
}: {
  params: Promise<{ level: string; slug: string; locale: keyof typeof messages }>;
}) {
  const { level, slug, locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return <LessonDetailClient slug={slug} levelCode={level.toUpperCase()} labels={t.lessonDetail} locale={locale} />;
}
