import { Card, CardContent, PageHeader } from "@nihongo-bjt/ui";
import { Suspense } from "react";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { RequireKeycloakAuth } from "../../../../components/auth/require-keycloak-auth";
import { AccountsSettingsClient } from "./_components/accounts-settings-client";

const messages = { ja, vi, en };

export default async function AccountsSettingsPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const loc = locale;

  return (
    <RequireKeycloakAuth locale={locale}>
      <main className="w-full space-y-6 pb-12">
        <PageHeader description={t.accounts.subtitle} title={t.accounts.title} />
        <Card className="border-ink/10 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <Suspense fallback={<p className="text-sm text-muted">{t.accounts.subtitle}</p>}>
              <AccountsSettingsClient labels={t.accounts} locale={loc} />
            </Suspense>
          </CardContent>
        </Card>
      </main>
    </RequireKeycloakAuth>
  );
}
