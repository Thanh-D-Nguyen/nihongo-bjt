// @vitest-environment jsdom

import { act } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  loadPermissions: vi.fn(),
  success: vi.fn(),
  error: vi.fn()
}));

vi.mock("@/lib/admin-api", () => ({ adminApiFetch: mocks.apiFetch }));
vi.mock("@/app/_components/admin-client-utils", () => ({ loadAdminPermissions: mocks.loadPermissions }));
vi.mock("@nihongo-bjt/ui", async () => {
  return {
    AdminDataTable: ({ children }: PropsWithChildren) => <div className="overflow-x-auto"><table>{children}</table></div>,
    AdminDataTableBody: ({ children }: PropsWithChildren) => <tbody>{children}</tbody>,
    AdminDataTableHead: ({ children }: PropsWithChildren) => <thead>{children}</thead>,
    AdminDataTableRow: ({ children }: PropsWithChildren) => <tr>{children}</tr>,
    AdminDataTableTd: ({ children }: PropsWithChildren) => <td>{children}</td>,
    AdminDataTableTh: ({ children }: PropsWithChildren) => <th>{children}</th>,
    AdminEmptyState: ({ title }: { title: string }) => <p>{title}</p>,
    AdminPageHeader: ({ title, description, actions }: PropsWithChildren<{ title: string; description: string; actions?: ReactNode }>) => <header><h1>{title}</h1><p>{description}</p>{actions}</header>,
    AdminSection: ({ children }: PropsWithChildren) => <section>{children}</section>,
    AdminStatusBadge: ({ children }: PropsWithChildren) => <span>{children}</span>,
    AdminToastContainer: () => null,
    cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
    useAdminToast: () => ({ toasts: [], removeToast: vi.fn(), success: mocks.success, error: mocks.error })
  };
});

import { DEFAULT_FLASHCARD_THEME } from "@nihongo-bjt/shared";
import { FlashcardStylesAdminClient } from "./flashcard-styles-admin-client";

const labels = {
  title: "Styles localized",
  desc: "Manage styles localized",
  empty: "No styles localized",
  error: "Could not load localized",
  loadFailed: "Could not load localized",
  create: "Create localized",
  edit: "Edit localized",
  save: "Save localized",
  saving: "Saving localized",
  cancel: "Cancel localized",
  refresh: "Refresh localized",
  preview: "Preview localized",
  slug: "Slug localized",
  nameKey: "Name key localized",
  descriptionKey: "Description localized",
  thumbnailUrl: "Thumbnail localized",
  tier: "Tier localized",
  sortOrder: "Order localized",
  status: "Status localized",
  config: "Config localized",
  users: "Users localized",
  actions: "Actions localized",
  allStatuses: "All statuses localized",
  allTiers: "All tiers localized",
  draft: "Draft localized",
  active: "Active localized",
  archived: "Archived localized",
  free: "Free localized",
  premium: "Premium localized",
  exclusive: "Exclusive localized",
  activate: "Activate localized",
  archive: "Archive localized",
  restore: "Restore localized",
  confirmStatus: "Confirm status localized",
  changeTo: "Change to localized",
  confirm: "Confirm localized",
  createTitle: "Create style localized",
  editTitle: "Edit style localized",
  invalidJson: "Invalid JSON localized",
  required: "Required fields localized",
  created: "Style created localized",
  updated: "Style updated localized",
  transitionSuccess: "Status changed localized",
  saveFailed: "Save failed localized",
  transitionFailed: "Transition failed localized",
  retry: "Retry localized",
  statusUnknown: "Unknown status localized",
  slugPlaceholder: "style-slug-placeholder",
  nameKeyPlaceholder: "style.name-key-placeholder",
  sampleTerm: "勉強",
  sampleReading: "べんきょう",
  sampleMeaning: "study"
};

const style = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "sakura",
  nameKey: "flashcard.sakura",
  descriptionKey: null,
  thumbnailUrl: null,
  config: DEFAULT_FLASHCARD_THEME.config,
  tier: "free",
  sortOrder: 1,
  status: "draft",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z"
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.loadPermissions.mockResolvedValue(new Set(["admin.content.write"]));
  mocks.apiFetch.mockImplementation((path: string) => {
    if (path === "/api/admin/flashcards/styles/analytics/adoption") return Promise.resolve(Response.json([]));
    if (path.startsWith("/api/admin/flashcards/styles?") || path === "/api/admin/flashcards/styles") return Promise.resolve(Response.json([style]));
    if (path.endsWith("/transition")) return Promise.resolve(Response.json({ id: style.id, status: "active" }));
    return Promise.resolve(Response.json({ id: style.id, updated: true }));
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

async function renderScreen() {
  await act(async () => {
    root.render(<FlashcardStylesAdminClient common={{ empty: "Empty", error: "Error", loading: "Loading", records: "Records" }} labels={labels} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(text: string) {
  const result = [...container.querySelectorAll<HTMLButtonElement>("button")].reverse().find((item) => item.textContent?.trim().endsWith(text));
  if (!result) throw new Error(`Button not found: ${text}`);
  return result;
}

describe("Admin flashcard styles screen", () => {
  it("uses supplied localized labels for the list and editor", async () => {
    await renderScreen();
    expect(container.textContent).toContain(labels.title);
    expect(container.textContent).toContain(labels.desc);
    expect(container.textContent).toContain(labels.refresh);
    expect(container.textContent).toContain(labels.activate);
    expect(container.textContent).not.toContain("Flashcard Styles");

    await act(async () => button(labels.create).click());
    expect(container.textContent).toContain(labels.createTitle);
    expect(container.textContent).toContain(labels.config);
    expect(container.textContent).toContain(labels.cancel);
  });

  it("keeps the wide table horizontally scrollable and editor fields single-column", async () => {
    await renderScreen();
    expect(container.querySelector("table")?.parentElement?.className).toContain("overflow-x-auto");
    await act(async () => button(labels.create).click());
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.className).toContain("w-[calc(100vw-2rem)]");
    expect(dialog?.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(container.querySelector(".grid")?.className).toContain("grid-cols-1");
  });

  it("shows a localized retry after load failure and recovers to the empty state", async () => {
    mocks.apiFetch.mockRejectedValueOnce(new Error("offline"));
    await renderScreen();
    expect(container.textContent).toContain(labels.loadFailed);
    mocks.apiFetch.mockImplementation((path: string) => {
      if (path === "/api/admin/flashcards/styles/analytics/adoption") return Promise.resolve(Response.json([]));
      return Promise.resolve(Response.json([]));
    });
    await act(async () => button(labels.retry).click());
    expect(container.textContent).toContain(labels.empty);
  });

  it("hides every write action when the current admin has no write permission", async () => {
    mocks.loadPermissions.mockResolvedValue(new Set(["admin.content.read"]));
    await renderScreen();
    expect([...container.querySelectorAll("button")].map((item) => item.textContent?.trim())).not.toContain(labels.create);
    expect(container.textContent).not.toContain(labels.edit);
    expect(container.textContent).not.toContain(labels.activate);
  });

  it("creates, edits, and transitions styles through their existing API routes", async () => {
    await renderScreen();
    await act(async () => button(labels.create).click());
    const slug = container.querySelector<HTMLInputElement>(`input[placeholder="${labels.slugPlaceholder}"]`)!;
    const nameKey = container.querySelector<HTMLInputElement>(`input[placeholder="${labels.nameKeyPlaceholder}"]`)!;
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setValue.call(slug, "new-style");
      slug.dispatchEvent(new Event("input", { bubbles: true }));
      setValue.call(nameKey, "flashcard.new-style");
      nameKey.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button(labels.create).click());
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/admin/flashcards/styles", expect.objectContaining({ method: "POST" }));

    await act(async () => button(labels.edit).click());
    await act(async () => button(labels.save).click());
    expect(mocks.apiFetch).toHaveBeenCalledWith(`/api/admin/flashcards/styles/${style.id}`, expect.objectContaining({ method: "PATCH" }));

    await act(async () => button(labels.activate).click());
    await act(async () => button(labels.confirm).click());
    expect(mocks.apiFetch).toHaveBeenCalledWith(`/api/admin/flashcards/styles/${style.id}/transition`, expect.objectContaining({ method: "POST" }));
  });
});
