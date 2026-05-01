import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { ImportOverviewClient } from "./import-overview-client";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const isVi = locale === "vi";
  return (
    <ImportOverviewClient
      locale={locale}
      labels={{
        title: t.adminConsole.import.title,
        description: t.adminConsole.import.subtitle,
        refresh: isVi ? "Làm mới" : "Refresh",
        loading: t.adminConsole.common.loading,
        error: t.adminConsole.common.error,
        pending: isVi ? "Đang chờ" : "Pending",
        inProgress: isVi ? "Đang xử lý" : "In progress",
        succeeded24h: isVi ? "Thành công 24h" : "Succeeded 24h",
        failed24h: isVi ? "Thất bại 24h" : "Failed 24h",
        errors24h: isVi ? "Lỗi 24h" : "Errors 24h",
        manifestsActive: isVi ? "Manifest active" : "Active manifests",
        failedQueueLink: isVi ? "Hàng đợi lỗi" : "Failed queue",
        manifestsLink: isVi ? "Manifest import" : "Import manifests",
        goToFailedQueue: isVi ? "Mở hàng đợi lỗi" : "Open failed queue",
        goToManifests: isVi ? "Mở manifest import" : "Open import manifests"
      }}
    />
  );
}

