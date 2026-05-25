import type { Metadata } from "next";
import { Suspense } from "react";
import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../components/auth/require-keycloak-auth";
import { ProfilePageClient } from "./_components/profile-page-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: t.profilePage.metaTitle };
}

export default async function ProfilePage({
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
          <div
            aria-busy="true"
            className="mx-auto min-h-[50vh] w-full max-w-3xl animate-pulse rounded-2xl bg-paper/70 px-4 py-10"
          />
        }
      >
        <ProfilePageClient
          labels={t.profilePage}
          gamificationLabels={t.gamification}
          locale={locale}
        />
      </Suspense>
    </RequireKeycloakAuth>
  );
}
