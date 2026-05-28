"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { KeycloakAuthProvider } from "../../../components/auth/keycloak-auth-provider";
import { usePresence, type ChallengeReceivedPayload } from "../../../hooks/use-presence";

import { AppearanceSync } from "../../_components/appearance-sync";
import { FocusMiniIndicator, type FocusMiniIndicatorLabels } from "../../_components/focus-mini-indicator";
import { LearnerAppFrame, type LearnerNavLabels } from "../../_components/learner-app-frame";
import { FocusTimerProvider } from "../../_hooks/use-focus-timer";
import type { CompanionBotLabels } from "../../_components/companion-bot";
import type { SearchDropdownLabels } from "../../_components/search-dropdown";

export interface PresenceNotificationLabels {
  accept: string;
  challengeReceived: string;
  decline: string;
  fallbackChallenger: string;
}

function PresenceConnector({
  labels,
  locale
}: {
  labels: PresenceNotificationLabels;
  locale: string;
}) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<ChallengeReceivedPayload | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChallengeReceived = useCallback(
    (payload: ChallengeReceivedPayload) => {
      setChallenge(payload);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      dismissTimerRef.current = setTimeout(() => setChallenge(null), 15_000);
    },
    []
  );

  useEffect(
    () => () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    },
    []
  );

  usePresence({ onChallengeReceived });

  if (!challenge) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="bg-surface border border-accent/20 rounded-2xl shadow-xl p-4 max-w-sm">
        <p className="text-sm font-semibold text-ink">
          {labels.challengeReceived.replace("{name}", challenge.fromDisplayName ?? labels.fallbackChallenger)}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              router.push(`/${locale}/battle?accept=${challenge.challengeId}&from=${challenge.fromUserId}`);
              setChallenge(null);
            }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sakura to-sakura/80 text-white text-sm font-semibold
              shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-150 min-h-[44px]"
          >
            {labels.accept}
          </button>
          <button
            onClick={() => setChallenge(null)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-muted/10 text-muted text-sm font-medium
              border border-muted/20 hover:bg-muted/15 active:scale-[0.97] transition-all duration-150 min-h-[44px]"
          >
            {labels.decline}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KeycloakAuthShell({
  children,
  companionLabels,
  focusTimerLabels,
  kcAccessCookiePresent = false,
  locale,
  nav,
  presenceLabels,
  searchLabels
}: {
  children: ReactNode;
  companionLabels: CompanionBotLabels;
  focusTimerLabels: FocusMiniIndicatorLabels;
  kcAccessCookiePresent?: boolean;
  locale: string;
  nav: LearnerNavLabels;
  presenceLabels: PresenceNotificationLabels;
  searchLabels: SearchDropdownLabels;
}) {
  return (
    <KeycloakAuthProvider kcAccessCookiePresent={kcAccessCookiePresent} locale={locale}>
      <PresenceConnector labels={presenceLabels} locale={locale} />
      <FocusTimerProvider>
        <AppearanceSync />
        <LearnerAppFrame companionLabels={companionLabels} locale={locale} nav={nav} searchLabels={searchLabels}>
          {children}
        </LearnerAppFrame>
        <FocusMiniIndicator labels={focusTimerLabels} />
      </FocusTimerProvider>
    </KeycloakAuthProvider>
  );
}
