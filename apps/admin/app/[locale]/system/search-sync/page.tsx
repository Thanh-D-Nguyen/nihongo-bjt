import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { SearchSyncClient } from "./search-sync-client";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const isVi = locale === "vi";
  return (
    <SearchSyncClient
      labels={{
        title: t.shell.navItems.searchSync ?? "Search Sync",
        description: isVi ? "Theo dõi độ tươi index Meilisearch và rebuild đầy đủ/từng phần (audit-only)." : "Monitor Meilisearch projection freshness and trigger full / partial rebuilds (audited).",
        refresh: isVi ? "Làm mới" : "Refresh",
        loading: t.adminConsole.common.loading,
        error: t.adminConsole.common.error,
        status: t.adminConsole.common.status,
        ageMs: isVi ? "Tuổi index" : "Index age",
        totalDocs: isVi ? "Tổng số tài liệu" : "Total docs",
        fullReindex: isVi ? "Rebuild toàn bộ" : "Full reindex",
        partialReindex: isVi ? "Rebuild từng phần" : "Partial reindex",
        fullConfirmHelp: isVi ? "Nhập 'rebuild-search-projection' để xác nhận." : "Type 'rebuild-search-projection' to confirm.",
        fullConfirmPlaceholder: "rebuild-search-projection",
        contentTypeLabel: isVi ? "Loại nội dung" : "Content type",
        reasonLabel: isVi ? "Lý do (≥3 ký tự)" : "Reason (≥3 chars)",
        reasonPlaceholder: isVi ? "Tại sao bạn rebuild?" : "Why are you rebuilding?",
        cancel: isVi ? "Hủy" : "Cancel",
        submit: isVi ? "Xác nhận" : "Submit",
        noPermission: isVi ? "Cần iam.manage để rebuild." : "iam.manage required.",
        successMessage: isVi ? "Đã ghi nhận yêu cầu rebuild." : "Rebuild request accepted."
      }}
    />
  );
}

