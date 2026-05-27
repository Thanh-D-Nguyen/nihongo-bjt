"use client";

import Link from "next/link";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";

/* ─── Types ─── */

interface SettingsTabLabels {
  account: string;
  accountDesc: string;
  appearance: string;
  appearanceDesc: string;
  reading: string;
  readingDesc: string;
  notifications: string;
  notificationsDesc: string;
  privacy: string;
  privacyDesc: string;
  subscription: string;
  subscriptionDesc: string;
  linkedAccounts: string;
  linkedAccountsDesc: string;
  signOut: string;
  signOutConfirm: string;
}

const SETTINGS_ITEMS: Array<{
  key: keyof Pick<SettingsTabLabels, "account" | "appearance" | "reading" | "notifications" | "privacy" | "subscription" | "linkedAccounts">;
  descKey: keyof SettingsTabLabels;
  icon: string;
  href: string;
}> = [
  { key: "account", descKey: "accountDesc", icon: "👤", href: "/settings/accounts" },
  { key: "appearance", descKey: "appearanceDesc", icon: "🎨", href: "/settings/appearance" },
  { key: "reading", descKey: "readingDesc", icon: "📖", href: "/settings/reading" },
  { key: "notifications", descKey: "notificationsDesc", icon: "🔔", href: "/settings/notifications" },
  { key: "privacy", descKey: "privacyDesc", icon: "🔒", href: "/settings/privacy" },
  { key: "subscription", descKey: "subscriptionDesc", icon: "💎", href: "/settings/subscription" },
  { key: "linkedAccounts", descKey: "linkedAccountsDesc", icon: "🔗", href: "/settings/linked-accounts" },
];

export function MeTabSettings({
  labels,
  settingsLabels: _settingsLabels,
  locale,
}: {
  labels: Record<string, string>;
  settingsLabels: unknown;
  locale: string;
}) {
  const auth = useKeycloakAuth();
  const t = labels as unknown as SettingsTabLabels;
  const base = `/${locale}`;

  return (
    <div className="space-y-4">
      {/* Settings grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={`${base}${item.href}`}
            className="group flex items-start gap-3 rounded-xl border border-ink/8 bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent/20 hover:shadow-md active:scale-[0.98]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/8 text-base" aria-hidden>
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t[item.key]}</p>
              <p className="mt-0.5 text-xs text-muted">{t[item.descKey]}</p>
            </div>
            <svg
              className="ml-auto mt-1 size-4 shrink-0 text-muted/40 transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
          </Link>
        ))}
      </div>

      {/* Sign out */}
      <div className="pt-4 border-t border-ink/8">
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 text-sm font-semibold text-red-700 transition-all hover:bg-red-100 hover:shadow-sm active:scale-[0.98]"
          onClick={() => {
            if (window.confirm(t.signOutConfirm)) {
              auth.logout();
            }
          }}
        >
          {t.signOut}
        </button>
      </div>
    </div>
  );
}
