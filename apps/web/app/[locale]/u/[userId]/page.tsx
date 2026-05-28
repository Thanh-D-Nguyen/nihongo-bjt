import type { Metadata } from "next";
import { Suspense } from "react";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { PublicProfileClient } from "./_components/public-profile-client";

const messages: Record<string, typeof vi> = { ja, vi, en };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; userId: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return {
    title: t.publicProfile.metaTitleFallback,
    description: t.publicProfile.metaDescription,
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ locale: string; userId: string }>;
}) {
  const { locale, userId } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper animate-pulse">
          <div className="h-48 bg-surface rounded-b-3xl" />
          <div className="max-w-2xl mx-auto px-4 -mt-16">
            <div className="w-28 h-28 rounded-full bg-surface border-4 border-paper" />
            <div className="mt-4 h-6 w-48 bg-surface rounded-lg" />
            <div className="mt-2 h-4 w-32 bg-surface rounded-lg" />
          </div>
        </div>
      }
    >
      <PublicProfileClient
        achievementNames={t.gamification.achievementNames}
        userId={userId}
        labels={t.publicProfile}
        locale={locale}
      />
    </Suspense>
  );
}
