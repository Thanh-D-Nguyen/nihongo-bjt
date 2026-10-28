import type { Metadata } from "next";
import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { NhkArticleDetailClient } from "./_components/nhk-article-detail-client";

const messages = { ja, vi, en };

function normalizeArticleId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const articleId = normalizeArticleId(id);
  const t = (messages as Record<string, typeof vi>)[locale] ?? messages.vi;
  const pageTitle = articleId.startsWith("normal")
    ? t.homepage.newsNormal
    : articleId.startsWith("business")
      ? (t.homepage.newsBusiness ?? t.homepage.newsNormal)
      : articleId.startsWith("livedoor")
        ? (t.homepage.newsLivedoor ?? t.homepage.newsNormal)
        : t.nhkDetail.title;
  return { title: `${pageTitle} — KotobaWorks` };
}

export default async function NhkArticlePage({
  params,
}: {
  params: Promise<{ locale: keyof typeof messages; id: string }>;
}) {
  const { locale, id } = await params;
  const t = messages[locale] ?? messages.vi;

  return <NhkArticleDetailClient articleId={normalizeArticleId(id)} labels={t.nhkDetail} locale={locale} />;
}
