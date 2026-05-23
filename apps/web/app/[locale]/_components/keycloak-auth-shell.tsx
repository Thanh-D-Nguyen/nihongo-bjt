"use client";

import type { ReactNode } from "react";

import { KeycloakAuthProvider } from "../../../components/auth/keycloak-auth-provider";

import { AppearanceSync } from "../../_components/appearance-sync";
import { FocusMiniIndicator, type FocusMiniIndicatorLabels } from "../../_components/focus-mini-indicator";
import { LearnerAppFrame, type LearnerNavLabels } from "../../_components/learner-app-frame";
import { FocusTimerProvider } from "../../_hooks/use-focus-timer";
import type { CompanionBotLabels } from "../../_components/companion-bot";
import type { SearchDropdownLabels } from "../../_components/search-dropdown";

export function KeycloakAuthShell({
  children,
  companionLabels,
  focusTimerLabels,
  kcAccessCookiePresent = false,
  locale,
  nav,
  searchLabels
}: {
  children: ReactNode;
  companionLabels: CompanionBotLabels;
  focusTimerLabels: FocusMiniIndicatorLabels;
  kcAccessCookiePresent?: boolean;
  locale: string;
  nav: LearnerNavLabels;
  searchLabels: SearchDropdownLabels;
}) {
  return (
    <KeycloakAuthProvider kcAccessCookiePresent={kcAccessCookiePresent} locale={locale}>
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
