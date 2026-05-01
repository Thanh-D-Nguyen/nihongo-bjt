import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { ReleaseClient } from "./release-client";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const isVi = locale === "vi";
  return (
    <ReleaseClient
      labels={{
        title: t.shell.navItems.release ?? "Release",
        description: isVi ? "Mark known-good cho release hiện tại và chuẩn bị rollback (audit-only, typed-confirmation)." : "Mark current release as known-good and prepare rollback (audited, typed-confirmation).",
        refresh: isVi ? "Làm mới" : "Refresh",
        loading: t.adminConsole.common.loading,
        error: t.adminConsole.common.error,
        empty: t.adminConsole.common.empty,
        markKnownGood: isVi ? "Đánh dấu known-good" : "Mark known-good",
        prepareRollback: isVi ? "Chuẩn bị rollback" : "Prepare rollback",
        versionLabel: isVi ? "Version" : "Version",
        versionPlaceholder: "1.2.3",
        targetVersionLabel: isVi ? "Target version" : "Target version",
        confirmHelp: isVi ? "Nhập lại version để xác nhận." : "Type the version again to confirm.",
        reasonLabel: isVi ? "Lý do (≥3 ký tự)" : "Reason (≥3 chars)",
        reasonPlaceholder: isVi ? "Tại sao bạn thực hiện?" : "Why?",
        cancel: isVi ? "Hủy" : "Cancel",
        submit: isVi ? "Xác nhận" : "Submit",
        noPermission: isVi ? "Cần iam.manage." : "iam.manage required.",
        history: isVi ? "Lịch sử release" : "Release history",
        action: "Action",
        actor: "Actor",
        reason: isVi ? "Lý do" : "Reason",
        at: isVi ? "Lúc" : "At"
      }}
    />
  );
}

