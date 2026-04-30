"use client";

import type { ReactNode } from "react";

import { KeycloakAuthProvider } from "../../../components/auth/keycloak-auth-provider";

import { LearnerAppFrame, type LearnerNavLabels } from "../../_components/learner-app-frame";

export function KeycloakAuthShell({
  children,
  kcAccessCookiePresent = false,
  locale,
  nav
}: {
  children: ReactNode;
  kcAccessCookiePresent?: boolean;
  locale: string;
  nav: LearnerNavLabels;
}) {
  return (
    <KeycloakAuthProvider kcAccessCookiePresent={kcAccessCookiePresent} locale={locale}>
      <LearnerAppFrame locale={locale} nav={nav}>
        {children}
      </LearnerAppFrame>
    </KeycloakAuthProvider>
  );
}
