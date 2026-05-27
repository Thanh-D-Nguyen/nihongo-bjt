import type { Metadata } from "next";
import { Suspense } from "react";

import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../components/auth/require-keycloak-auth";
import { MePageClient } from "./_components/me-page-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: t.mePage.metaTitle };
}

export default async function MePage({
  params,
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireKeycloakAuth locale={locale}>
      <Suspense
        fallback={
          <div aria-busy="true" className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8">
            <div className="h-48 animate-pulse rounded-2xl bg-ink/5" />
            <div className="h-12 animate-pulse rounded-xl bg-ink/5" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-ink/5" />
              ))}
            </div>
          </div>
        }
      >
        <MePageClient
          labels={t.mePage}
          analyticsLabels={t.analytics}
          gamificationLabels={t.gamification}
          settingsLabels={{ settings: t.settings, accountInfo: t.accountInfo }}
          locale={locale}
        />
      </Suspense>
    </RequireKeycloakAuth>
  );
}
