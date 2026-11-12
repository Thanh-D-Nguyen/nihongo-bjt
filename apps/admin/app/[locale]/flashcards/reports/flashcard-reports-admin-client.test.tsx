// @vitest-environment jsdom

import { act } from "react";
import type { PropsWithChildren } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), permissions: vi.fn() }));
vi.mock("@/lib/admin-api", () => ({ adminApiFetch: mocks.fetch }));
vi.mock("@/app/_components/admin-client-utils", () => ({ loadAdminPermissions: mocks.permissions }));
vi.mock("@nihongo-bjt/ui", () => ({
  AdminPageHeader: ({ title, description }: { title: string; description: string }) => <header><h1>{title}</h1><p>{description}</p></header>,
  AdminSection: ({ children }: PropsWithChildren) => <section>{children}</section>,
  AdminDataTable: ({ children }: PropsWithChildren) => <table>{children}</table>,
  AdminDataTableHead: ({ children }: PropsWithChildren) => <thead>{children}</thead>,
  AdminDataTableBody: ({ children }: PropsWithChildren) => <tbody>{children}</tbody>,
  AdminDataTableRow: ({ children }: PropsWithChildren) => <tr>{children}</tr>,
  AdminDataTableTh: ({ children }: PropsWithChildren) => <th>{children}</th>,
  AdminDataTableTd: ({ children }: PropsWithChildren) => <td>{children}</td>,
  AdminEmptyState: ({ title }: { title: string }) => <p>{title}</p>
}));

import { FlashcardReportsAdminClient } from "./flashcard-reports-admin-client";

const labels: Record<string, string> = {
  title: "Reports", subtitle: "Moderate decks", filterStatus: "Filter", pending: "Pending",
  resolved: "Removed", dismissed: "Dismissed", deck: "Deck", reason: "Reason",
  date: "Date", deckStatus: "Deck status", action: "Review", note: "Review note",
  remove: "Remove deck", dismiss: "Dismiss report", cancel: "Cancel", refresh: "Refresh",
  noteRequired: "At least three characters", confirmRemove: "Archive this deck?",
  reviewFailed: "Review failed", loadFailed: "Load failed", readOnly: "Read only",
  reviewed: "Reviewed", previous: "Previous", next: "Next", page: "Page"
};
const report = {
  id: "report-id", deckId: "deck-id", titleVi: "Reported deck", titleJa: null,
  deckStatus: "active", reason: "spam", status: "pending",
  createdAt: "2026-11-10T00:00:00Z", reviewedAt: null, reviewNote: null
};

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.permissions.mockResolvedValue(new Set(["admin.content.read", "admin.content.write"]));
  mocks.fetch.mockImplementation((path: string) => Promise.resolve(Response.json(
    path.endsWith("/review") ? { status: "resolved" } : { items: [report], total: 1, page: 1, pageSize: 50 }
  )));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () => {
    root.render(<FlashcardReportsAdminClient labels={labels} common={{ loading: "Loading", empty: "Empty", error: "Error", records: "Records" }} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
function click(text: string) {
  const button = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!button) throw new Error(`Missing button ${text}`);
  button.click();
}
function setReviewNote(value: string) {
  const textarea = container.querySelector("textarea")!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  setter.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}
function reviewCalls() {
  return mocks.fetch.mock.calls.filter(([path]) => typeof path === "string" && path.endsWith("/review"));
}

describe("flashcard report moderation", () => {
  it("shows pending reports and prevents read-only users from taking action", async () => {
    mocks.permissions.mockResolvedValue(new Set(["admin.content.read"]));
    await render();
    expect(container.textContent).toContain("Reported deck");
    expect(container.textContent).toContain(labels.readOnly);
    expect([...container.querySelectorAll("button")].some((button) => button.textContent === labels.action)).toBe(false);
  });

  it("requires a review note and submits a dismissal once", async () => {
    await render();
    await act(async () => click(labels.action));
    await act(async () => click(labels.dismiss));
    expect(container.textContent).toContain(labels.noteRequired);
    expect(reviewCalls()).toHaveLength(0);
    await act(async () => setReviewNote("False report"));
    await act(async () => { click(labels.dismiss); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(mocks.fetch).toHaveBeenCalledWith("/api/admin/flashcards/reports/report-id/review", expect.objectContaining({
      method: "POST", body: JSON.stringify({ action: "dismiss", note: "False report" })
    }));
    expect(reviewCalls()).toHaveLength(1);
  });

  it("requires confirmation before removing a public deck", async () => {
    await render();
    await act(async () => click(labels.action));
    await act(async () => setReviewNote("Spam confirmed"));
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    await act(async () => click(labels.remove));
    expect(confirm).toHaveBeenCalledWith(labels.confirmRemove);
    expect(reviewCalls()).toHaveLength(0);
  });
});
