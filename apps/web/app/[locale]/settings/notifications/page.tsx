import Link from "next/link";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../../components/auth/require-keycloak-auth";
import { NotificationsSettingsClient } from "./_components/notifications-settings-client";

const messages = { ja, vi, en };

export default async function NotificationsSettingsPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <RequireKeycloakAuth locale={locale}>
      <NotificationsSettingsClient labels={t.notificationsPage} />
      <Link
        className="text-sm font-medium text-muted underline-offset-4 hover:text-ink hover:underline"
        href={`/${locale}/settings`}
      >
        ← {t.settings.title}
      </Link>
    </RequireKeycloakAuth>
  );
}
