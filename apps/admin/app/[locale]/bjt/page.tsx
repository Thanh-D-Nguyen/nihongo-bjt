import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { BjtDashboardClient } from "./bjt-dashboard-client";

const messages = { ja, vi, en };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = (messages[locale] ?? messages.vi) as typeof vi;
  const labels =
    ((t.adminConsole as unknown as Record<string, Record<string, string>>).bjtDashboard) ??
    ((vi.adminConsole as unknown as Record<string, Record<string, string>>).bjtDashboard);
  return <BjtDashboardClient labels={labels} locale={locale} />;
}

