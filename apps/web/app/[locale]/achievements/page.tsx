import type { Metadata } from "next";
import { Suspense } from "react";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../components/auth/require-keycloak-auth";
import { AchievementsPageClient } from "./_components/achievements-page-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.gamification.title} — NihonGo BJT` };
}

export default async function AchievementsPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireKeycloakAuth locale={locale}>
      <Suspense
        fallback={
          <div
            aria-busy="true"
            className="mx-auto min-h-[50vh] w-full max-w-4xl animate-pulse rounded-2xl bg-paper/70 px-3 py-10 sm:px-5"
          />
        }
      >
        <AchievementsPageClient labels={t.gamification} locale={locale} />
      </Suspense>
    </RequireKeycloakAuth>
  );
}
