import type { Metadata } from "next";
import { SearchHistoryClient } from "./_components/search-history-client";

const historyLabels = {
  vi: {
    title: "Lịch sử tìm kiếm",
    empty: "Bạn chưa tìm kiếm gì.",
    clearAll: "Xóa tất cả",
    searchAgain: "Tìm lại",
    remove: "Xóa"
  },
  ja: {
    title: "検索履歴",
    empty: "検索履歴がありません。",
    clearAll: "すべて削除",
    searchAgain: "再検索",
    remove: "削除"
  }
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const labels = historyLabels[locale as keyof typeof historyLabels] ?? historyLabels.vi;
  return { title: `${labels.title} — NihonGo BJT` };
}

export default async function SearchHistoryPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const labels = historyLabels[locale as keyof typeof historyLabels] ?? historyLabels.vi;
  return <SearchHistoryClient labels={labels} locale={locale} />;
}
