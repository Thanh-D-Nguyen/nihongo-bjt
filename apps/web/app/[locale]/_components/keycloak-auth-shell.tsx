"use client";

import type { ReactNode } from "react";

import { KeycloakAuthProvider } from "../../../components/auth/keycloak-auth-provider";

import { LearnerAppFrame, type LearnerNavLabels } from "../../_components/learner-app-frame";
import type { CompanionBotLabels } from "../../_components/companion-bot";
import type { SearchDropdownLabels } from "../../_components/search-dropdown";

export function KeycloakAuthShell({
  children,
  companionLabels,
  kcAccessCookiePresent = false,
  locale,
  nav,
  searchLabels
}: {
  children: ReactNode;
  companionLabels: CompanionBotLabels;
  kcAccessCookiePresent?: boolean;
  locale: string;
  nav: LearnerNavLabels;
  searchLabels: SearchDropdownLabels;
}) {
  return (
    <KeycloakAuthProvider kcAccessCookiePresent={kcAccessCookiePresent} locale={locale}>
      <LearnerAppFrame companionLabels={companionLabels} locale={locale} nav={nav} searchLabels={searchLabels}>
        {children}
      </LearnerAppFrame>
    </KeycloakAuthProvider>
  );
}
