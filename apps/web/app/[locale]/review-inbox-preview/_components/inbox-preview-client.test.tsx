// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { act } = React;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  careerInbox: vi.fn(),
  submitContextMemoFeedback: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", { href, ...props }, children)
}));
vi.mock("../../../../src/features/career-rpg/api", () => ({
  careerInbox: mocks.careerInbox,
  submitContextMemoFeedback: mocks.submitContextMemoFeedback
}));

import messages from "../../../../messages/vi.json";
import { InboxPreviewClient } from "./inbox-preview-client";

describe("InboxPreviewClient", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("redirects anonymous learners to login instead of showing an empty inbox", async () => {
    mocks.careerInbox.mockRejectedValue(new Error("Career RPG API failed: 401"));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InboxPreviewClient labels={messages.careerRpg} locale="vi" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.router.replace).toHaveBeenCalledWith(
      "/vi/login?returnTo=%2Fvi%2Freview-inbox-preview"
    );
    expect(container.textContent).not.toContain("Hộp thư của bạn hiện chưa có memo.");

    await act(async () => root.unmount());
    container.remove();
  });

  it("shows the localized empty state when the authenticated inbox has no memos", async () => {
    mocks.careerInbox.mockResolvedValue([]);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InboxPreviewClient labels={messages.careerRpg} locale="vi" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Hộp thư của bạn hiện chưa có memo.");

    await act(async () => root.unmount());
    container.remove();
  });

  it("shows a load error instead of an empty inbox when the API fails", async () => {
    mocks.careerInbox.mockRejectedValue(new Error("Career RPG API failed: 500"));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InboxPreviewClient labels={messages.careerRpg} locale="vi" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Không thể tải Review Inbox.");
    expect(container.textContent).not.toContain("Hộp thư của bạn hiện chưa có memo.");

    await act(async () => root.unmount());
    container.remove();
  });

  it("persists inbox feedback and updates the memo status", async () => {
    const memo = {
      id: "memo-1",
      cardKind: "expression_pair" as const,
      expressionJa: "少々お時間をいただけますか",
      reading: "しょうしょうおじかんをいただけますか",
      surfaceMeaningVi: "Xin chút thời gian",
      realIntentVi: "Tôi cần thêm thời gian",
      sceneJa: "会議",
      toneVi: "Lịch sự",
      bjtTrapVi: "Không phải từ chối",
      fromNpcSlug: "sato",
      generatedAt: "2026-10-11T00:00:00.000Z",
      status: "unread" as const
    };
    mocks.careerInbox.mockResolvedValue([memo]);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InboxPreviewClient labels={messages.careerRpg} locale="vi" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    const markRead = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("使えそう")
    );
    expect(markRead).toBeDefined();
    await act(async () => {
      markRead?.click();
      await Promise.resolve();
    });
    expect(mocks.submitContextMemoFeedback).toHaveBeenCalledWith("memo-1", "useful");
    expect(container.textContent).toContain("既読");

    await act(async () => root.unmount());
    container.remove();
  });

  it("redirects to login when the feedback request finds an expired session", async () => {
    mocks.careerInbox.mockResolvedValue([
      {
        id: "memo-1",
        cardKind: "expression_pair",
        expressionJa: "少々お時間をいただけますか",
        reading: "しょうしょうおじかんをいただけますか",
        surfaceMeaningVi: "Xin chút thời gian",
        realIntentVi: "Tôi cần thêm thời gian",
        sceneJa: "会議",
        toneVi: "Lịch sự",
        bjtTrapVi: "Không phải từ chối",
        fromNpcSlug: "sato",
        generatedAt: "2026-10-11T00:00:00.000Z",
        status: "unread"
      }
    ]);
    mocks.submitContextMemoFeedback.mockRejectedValue(new Error("Career RPG API failed: 401"));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<InboxPreviewClient labels={messages.careerRpg} locale="vi" />);
      await Promise.resolve();
      await Promise.resolve();
    });
    const useful = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("使えそう")
    );
    await act(async () => {
      useful?.click();
      await Promise.resolve();
    });

    expect(mocks.router.replace).toHaveBeenCalledWith(
      "/vi/login?returnTo=%2Fvi%2Freview-inbox-preview"
    );
    expect(container.textContent).not.toContain("Không thể lưu phản hồi.");

    await act(async () => root.unmount());
    container.remove();
  });
});
