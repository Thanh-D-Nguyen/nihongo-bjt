import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { QueueHealthClient } from "./queue-health-client";

const messages = { en, ja, vi };

export default async function Page({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const isVi = locale === "vi";
  return (
    <QueueHealthClient
      labels={{
        title: "Queue Health",
        description: isVi ? "Theo dõi queue và can thiệp pause/resume/drain (audit-only)." : "Monitor queues and apply pause/resume/drain (audited).",
        refresh: isVi ? "Làm mới" : "Refresh",
        loading: t.adminConsole.common.loading,
        error: t.adminConsole.common.error,
        empty: t.adminConsole.common.empty,
        pause: isVi ? "Tạm dừng" : "Pause",
        resume: isVi ? "Tiếp tục" : "Resume",
        drain: "Drain",
        drainConfirmHelp: isVi ? "Nhập đúng tên queue để xác nhận drain." : "Type the queue name exactly to confirm drain.",
        drainConfirmPlaceholder: isVi ? "Tên queue" : "Queue name",
        reasonLabel: isVi ? "Lý do (≥3 ký tự)" : "Reason (≥3 chars)",
        reasonPlaceholder: isVi ? "Tại sao bạn thực hiện hành động này?" : "Why are you taking this action?",
        cancel: isVi ? "Hủy" : "Cancel",
        submit: isVi ? "Xác nhận" : "Submit",
        pending: isVi ? "Đang chờ" : "Pending",
        inProgress: isVi ? "Đang xử lý" : "In progress",
        succeeded24h: isVi ? "Thành công 24h" : "Succeeded 24h",
        failed24h: isVi ? "Thất bại 24h" : "Failed 24h",
        paused: isVi ? "Đang tạm dừng" : "Paused",
        noPermission: isVi ? "Cần iam.manage để can thiệp queue." : "iam.manage required to mutate queues.",
        recentActions: isVi ? "Hành động gần đây" : "Recent actions"
      }}
    />
  );
}

