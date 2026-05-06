import type { Metadata } from "next";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { NhkArticleDetailClient } from "./_components/nhk-article-detail-client";

const messages = { ja, vi };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = (messages as Record<string, typeof vi>)[locale] ?? messages.vi;
  return { title: `${t.nhkDetail.title} — NihonGo BJT` };
}

export default async function NhkArticlePage({
  params,
}: {
  params: Promise<{ locale: keyof typeof messages; id: string }>;
}) {
  const { locale, id } = await params;
  const t = messages[locale] ?? messages.vi;

  return <NhkArticleDetailClient articleId={id} labels={t.nhkDetail} locale={locale} />;
}
