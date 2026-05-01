import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { ImportManifestsClient } from "./import-manifests-client";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const isVi = locale === "vi";
  return (
    <ImportManifestsClient
      labels={{
        title: t.shell.navItems.importManifests ?? "Import manifests",
        description: isVi ? "Quản lý manifest mapping import (CRUD + run)." : "Manage import mapping manifests (CRUD + run).",
        refresh: isVi ? "Làm mới" : "Refresh",
        loading: t.adminConsole.common.loading,
        error: t.adminConsole.common.error,
        empty: t.adminConsole.common.empty,
        create: isVi ? "Tạo manifest" : "Create manifest",
        edit: isVi ? "Sửa" : "Edit",
        run: isVi ? "Chạy" : "Run",
        archive: isVi ? "Lưu trữ" : "Archive",
        status: isVi ? "Trạng thái" : "Status",
        source: isVi ? "Nguồn" : "Source",
        target: isVi ? "Đích" : "Target",
        version: "Version",
        notes: "Notes",
        mappingJson: isVi ? "Mapping (JSON)" : "Mapping (JSON)",
        reasonLabel: isVi ? "Lý do (≥3 ký tự)" : "Reason (≥3 chars)",
        reasonPlaceholder: isVi ? "Tại sao?" : "Why?",
        cancel: isVi ? "Hủy" : "Cancel",
        submit: isVi ? "Xác nhận" : "Submit",
        noPermission: isVi ? "Cần iam.manage." : "iam.manage required.",
        invalidJson: isVi ? "Mapping JSON không hợp lệ." : "Invalid mapping JSON.",
        history: isVi ? "Lịch sử" : "History",
        runOnlyActive: isVi ? "Chỉ manifest active mới có thể chạy." : "Only active manifests can be run."
      }}
    />
  );
}

