import { ActionCard, PageHeader, SectionHeader } from "@nihongo-bjt/ui";
import Link from "next/link";

import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

const messages = { ja, vi };

export default async function SettingsHubPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const base = `/${locale}`;

  return (
    <main className="w-full space-y-8 pb-12">
      <PageHeader description={t.settings.subtitle} eyebrow={t.settings.eyebrow} title={t.settings.title} />
      <section aria-labelledby="settings-shortcuts-heading">
        <SectionHeader
          heading="h2"
          id="settings-shortcuts-heading"
          title={t.settings.shortcutsTitle}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
          <ActionCard
            description={t.settings.accountsDesc}
            href={`${base}/settings/accounts`}
            title={t.settings.accounts}
          />
          <ActionCard
            description={t.settings.notificationsDesc}
            href={`${base}/settings/notifications`}
            title={t.settings.notifications}
          />
          <ActionCard
            description={t.settings.privacyDesc}
            href={`${base}/settings/privacy`}
            title={t.settings.privacy}
          />
          <ActionCard
            description={t.settings.readingAssistDesc}
            href={`${base}/settings/reading`}
            title={t.settings.readingAssist}
          />
        </div>
        <p className="mt-6 text-sm text-muted">
          <Link className="font-medium text-ink underline-offset-4 hover:underline" href={base}>
            {t.settings.backToHome}
          </Link>
        </p>
      </section>
    </main>
  );
}
