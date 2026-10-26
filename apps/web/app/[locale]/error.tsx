"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import en from "../../messages/en.json";
import ja from "../../messages/ja.json";
import vi from "../../messages/vi.json";

export default function LocaleError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const locale = params?.locale === "ja" ? "ja" : params?.locale === "en" ? "en" : "vi";
  const t = { vi, ja, en }[locale].systemPages;

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center bg-paper px-4 text-center text-ink">
      <h1 className="text-2xl font-bold">{t.errorTitle}</h1>
      <p className="mt-2 text-sm text-muted">{t.errorDescription}</p>
      {error.digest && <p className="mt-3 text-xs text-muted">{t.errorReference.replace("{reference}", error.digest)}</p>}
      <button className="mt-6 min-h-12 rounded-xl bg-action px-5 py-2.5 text-sm font-medium text-white hover:bg-action-hover" onClick={reset} type="button">{t.retry}</button>
      <Link className="mt-3 inline-flex min-h-12 items-center text-sm text-accent" href={`/${locale}`}>{t.home}</Link>
    </main>
  );
}
