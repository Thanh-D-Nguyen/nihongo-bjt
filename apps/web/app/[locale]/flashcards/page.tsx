import type { Metadata } from "next";
import { Suspense } from "react";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../components/auth/require-keycloak-auth";
import { FlashcardsPageClient } from "./_components/flashcards-page-client";

const messages: Record<string, typeof vi> = { ja, vi };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return { title: `${t.flashcards.title} — NihonGo BJT` };
}

export default async function FlashcardsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: keyof typeof messages }>;
  searchParams: Promise<{ tab?: string; deckId?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = messages[locale] ?? messages.vi;
  const deckIdOk =
    typeof sp.deckId === "string" &&
    /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(sp.deckId);
  const initialMain = sp.tab === "review" || deckIdOk ? ("review" as const) : ("library" as const);

  return (
    <RequireKeycloakAuth locale={locale}>
      <Suspense
        fallback={
          <div
            aria-busy="true"
            className="mx-auto min-h-[50vh] w-full max-w-7xl animate-pulse rounded-2xl bg-paper/70 px-3 py-10 sm:px-5"
          />
        }
      >
        <FlashcardsPageClient
          deckLabels={t.decks}
          flashcardLabels={t.flashcards}
          initialMain={initialMain}
          locale={locale}
          reviewSessionLabels={t.reviewSession}
        />
      </Suspense>
    </RequireKeycloakAuth>
  );
}
