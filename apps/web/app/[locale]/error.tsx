"use client";

import { useParams } from "next/navigation";

const copy = {
  vi: { title: "Đã xảy ra lỗi", desc: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.", retry: "Thử lại" },
  ja: { title: "エラーが発生しました", desc: "申し訳ございません。もう一度お試しください。", retry: "再試行" },
};

export default function LocaleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = (params?.locale as string) === "ja" ? "ja" : "vi";
  const t = copy[locale];

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-ink">{t.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.desc}</p>
      <button
        className="mt-6 rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-surface hover:bg-ink/90"
        onClick={() => reset()}
        type="button"
      >
        {t.retry}
      </button>
    </main>
  );
}
