import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { ImportFailedClient } from "./import-failed-client";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const isVi = locale === "vi";
  return (
    <ImportFailedClient
      labels={{
        title: t.shell.navItems.importFailed ?? "Import failed queue",
        description: isVi ? "Hàng đợi lỗi import-staging: retry, discard, bulk (audit-only)." : "Import-staging error queue: retry, discard, bulk (audited).",
        refresh: isVi ? "Làm mới" : "Refresh",
        loading: t.adminConsole.common.loading,
        error: t.adminConsole.common.error,
        empty: t.adminConsole.common.empty,
        retry: isVi ? "Thử lại" : "Retry",
        discard: isVi ? "Bỏ qua" : "Discard",
        bulkRetry: isVi ? "Thử lại nhiều" : "Bulk retry",
        bulkDiscard: isVi ? "Bỏ qua nhiều" : "Bulk discard",
        filterPhase: isVi ? "Phase" : "Phase",
        filterSeverity: isVi ? "Mức độ" : "Severity",
        filterAll: isVi ? "Tất cả" : "All",
        selected: isVi ? "Đã chọn" : "Selected",
        reasonLabel: isVi ? "Lý do (≥3 ký tự)" : "Reason (≥3 chars)",
        reasonPlaceholder: isVi ? "Tại sao?" : "Why?",
        cancel: isVi ? "Hủy" : "Cancel",
        submit: isVi ? "Xác nhận" : "Submit",
        noPermission: isVi ? "Cần content.manage hoặc iam.manage." : "content.manage or iam.manage required.",
        rawItem: "Raw item",
        sourceKey: "Source key",
        message: isVi ? "Thông điệp" : "Message",
        phase: "Phase",
        severity: isVi ? "Mức độ" : "Severity",
        actions: isVi ? "Hành động" : "Actions"
      }}
    />
  );
}

