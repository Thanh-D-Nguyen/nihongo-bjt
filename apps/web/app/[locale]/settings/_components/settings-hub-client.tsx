"use client";

import {
  Button,
  PageHeader,
  SectionHeader,
} from "@nihongo-bjt/ui";
import Link from "next/link";

import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";

/* ── Types ── */

type SettingsLabels = {
  title: string;
  subtitle: string;
  eyebrow: string;
  profileSection: string;
  linkedAccounts: string;
  linkedAccountsDesc: string;
  notifications: string;
  notificationsDesc: string;
  privacy: string;
  privacyDesc: string;
  readingAssist: string;
  readingAssistDesc: string;
  appearance: string;
  appearanceDesc: string;
  subscription: string;
  subscriptionDesc: string;
  settingsArea: string;
  backToHome: string;
  signOut: string;
};

type AccountInfoLabels = {
  identityTitle: string;
  displayName: string;
  email: string;
  accountStatus: string;
  signedIn: string;
  signedOut: string;
  localeLabel: string;
  learningSummary: string;
  streak: string;
  reviews: string;
  accuracy: string;
  dueReviews: string;
};

/* ── Settings nav card ── */

function SettingsNavCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      className="group block outline-none transition-all duration-150 active:scale-[0.98]"
      href={href}
    >
      <div className="flex items-start gap-3.5 rounded-2xl border border-ink/8 bg-surface p-4 shadow-xs transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-accent/20 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-accent/30 group-focus-visible:ring-offset-2">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/8 text-lg" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
        </div>
        <svg className="ml-auto mt-0.5 size-4 shrink-0 text-muted/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4" /></svg>
      </div>
    </Link>
  );
}

/* ── Main component ── */

export function SettingsHubClient({
  labels,
  locale,
}: {
  labels: {
    settings: SettingsLabels;
    accountInfo: AccountInfoLabels;
    appearancePage: { title: string };
  };
  locale: string;
}) {
  const auth = useKeycloakAuth();

  const s = labels.settings;
  const a = labels.accountInfo;
  const base = `/${locale}`;

  const userLabel = auth.displayName || auth.email || auth.userId || "";
  const initial = (userLabel.trim().charAt(0) || "N").toUpperCase();

  return (
    <main className="w-full space-y-6 pb-12">
      <PageHeader
        eyebrow={s.eyebrow}
        title={s.title}
        description={s.subtitle}
      />

      {/* ── Profile quick link ── */}
      <Link
        className="group flex items-center gap-4 rounded-2xl border border-ink/8 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md"
        href={`${base}/profile`}
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-base font-bold text-surface shadow-sm">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{userLabel || a.signedOut}</p>
          <p className="truncate text-xs text-muted">{auth.email || a.email}</p>
        </div>
        <svg className="size-4 shrink-0 text-muted/40 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </Link>

      {/* ── Settings bento grid ── */}
      <section aria-labelledby="settings-area-heading">
        <SectionHeader
          heading="h2"
          id="settings-area-heading"
          title={s.settingsArea}
        />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SettingsNavCard
            href={`${base}/settings/linked-accounts`}
            icon="🔗"
            title={s.linkedAccounts}
            description={s.linkedAccountsDesc}
          />
          <SettingsNavCard
            href={`${base}/settings/notifications`}
            icon="🔔"
            title={s.notifications}
            description={s.notificationsDesc}
          />
          <SettingsNavCard
            href={`${base}/settings/appearance`}
            icon="🎨"
            title={s.appearance}
            description={s.appearanceDesc}
          />
          <SettingsNavCard
            href={`${base}/settings/reading`}
            icon="📖"
            title={s.readingAssist}
            description={s.readingAssistDesc}
          />
          <SettingsNavCard
            href={`${base}/settings/privacy`}
            icon="🔒"
            title={s.privacy}
            description={s.privacyDesc}
          />
          <SettingsNavCard
            href={`${base}/settings/subscription`}
            icon="💎"
            title={s.subscription}
            description={s.subscriptionDesc}
          />
        </div>
      </section>

      {/* ── Footer actions ── */}
      <div className="flex items-center justify-between border-t border-ink/6 pt-5">
        <Link
          className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
          href={base}
        >
          {s.backToHome}
        </Link>
        {auth.accessToken ? (
          <Button variant="danger" type="button" onClick={auth.logout}>
            {s.signOut}
          </Button>
        ) : null}
      </div>
    </main>
  );
}
