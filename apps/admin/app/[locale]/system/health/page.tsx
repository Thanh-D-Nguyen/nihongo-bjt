import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { SystemHealthClient } from "./system-health-client";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <SystemHealthClient
      labels={{
        title: t.shell.navItems.systemHealth ?? "System Health",
        description: t.overview.subtitle,
        refresh: t.adminConsole.common.allStatuses ? "Refresh" : "Refresh",
        loading: t.adminConsole.common.loading,
        error: t.adminConsole.common.error,
        generatedAt: t.adminConsole.common.updatedAt,
        status: t.adminConsole.common.status,
        dbStatus: "DB",
        featureFlags: t.shell.navItems.featureFlags,
        deadLetters: t.shell.navItems.deadLetter,
        importErrors24h: t.overview.importErrorsTitle,
        scheduledOps24h: "Scheduled ops 24h",
        refreshHelp: t.adminConsole.analyticsCommon.refreshHelp
      }}
    />
  );
}

