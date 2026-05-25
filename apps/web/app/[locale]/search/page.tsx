import type { Metadata } from "next";
import { Suspense } from "react";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { SearchClient } from "./_components/search-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.search.title} — NihonGo BJT` };
}

export default async function SearchPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <Suspense
      fallback={
        <div
          aria-busy="true"
          className="mx-auto min-h-[40vh] w-full max-w-6xl animate-pulse rounded-2xl bg-paper/70 px-4 py-12 motion-reduce:animate-none sm:px-6"
        />
      }
    >
      <SearchClient labels={t.search} locale={locale} />
    </Suspense>
  );
}
