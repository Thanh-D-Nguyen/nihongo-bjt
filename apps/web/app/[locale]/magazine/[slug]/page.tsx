import type { Metadata } from "next";
import { notFound } from "next/navigation";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { MagazineArticleView } from "../_components/magazine-article-view";

const messages: Record<string, typeof vi> = { ja, vi, en };

export const dynamic = "force-dynamic";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

async function fetchArticle(slug: string) {
  try {
    const res = await fetch(`${apiBaseUrl}/api/magazine/${slug}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) return { title: "Not Found" };

  return {
    title: `${article.titleJp} — NihonGo Magazine`,
    description: article.seoDescription ?? article.summaryVi ?? "",
    openGraph: {
      title: `${article.titleJp} | ${article.titleVi}`,
      description: article.summaryVi ?? "",
      type: "article",
      publishedTime: article.publishedAt ?? article.publishDate,
      images: article.ogImageUrl ? [article.ogImageUrl] : undefined,
    },
  };
}

export default async function MagazineArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) notFound();
  const t = messages[locale] ?? messages.vi;

  return <MagazineArticleView article={article} locale={locale} t={t.magazine} />;
}
