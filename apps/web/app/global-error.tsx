"use client";

import { useEffect, useState } from "react";
import { applyTheme, loadCachedAppearance } from "../lib/appearance";
import en from "../messages/en.json";
import ja from "../messages/ja.json";
import vi from "../messages/vi.json";
import "./globals.css";

export default function GlobalError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<"vi" | "ja" | "en">("vi");
  useEffect(() => {
    const segment = window.location.pathname.split("/")[1];
    setLocale(segment === "ja" || segment === "en" ? segment : "vi");
    applyTheme(loadCachedAppearance().theme);
  }, []);
  const t = { vi, ja, en }[locale].systemPages;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="bg-paper text-ink">
        <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <h1 className="text-2xl font-bold">{t.errorTitle}</h1>
          <p className="mt-2 text-sm text-muted">{t.errorDescription}</p>
          {error.digest && <p className="mt-3 text-xs text-muted">{t.errorReference.replace("{reference}", error.digest)}</p>}
          <button className="mt-6 min-h-12 rounded-xl bg-action px-5 py-2.5 text-sm font-medium text-white hover:bg-action-hover" onClick={reset} type="button">{t.retry}</button>
          <a className="mt-3 inline-flex min-h-12 items-center text-sm text-accent" href={`/${locale}`}>{t.home}</a>
        </main>
      </body>
    </html>
  );
}
