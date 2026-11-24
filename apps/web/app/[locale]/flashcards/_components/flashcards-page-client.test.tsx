// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../../messages/en.json";
import viMessages from "../../../../messages/vi.json";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { FlashcardsPageClient } from "./flashcards-page-client";

const { adSlotRenderMock, replaceMock, searchParamsRef } = vi.hoisted(() => ({
  adSlotRenderMock: vi.fn(),
  replaceMock: vi.fn(),
  searchParamsRef: { value: "" }
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/vi/flashcards",
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(searchParamsRef.value)
}));

vi.mock("../../../../lib/go-auth-provider", () => ({
  useGoAuth: () => ({ userId: "learner-1" })
}));

vi.mock("../../../../lib/offline-review-queue", () => ({
  queueSizeForUser: async () => 0
}));

vi.mock("../../../../lib/learner-api", () => ({
  learnerApiFetch: vi.fn()
}));

vi.mock("./deck-browser", () => ({
  DeckBrowser: () => <div data-testid="deck-browser-mock">deck-browser</div>
}));

vi.mock("./review-session", () => ({
  ReviewSession: () => <div data-testid="review-session-mock">review-session</div>
}));

vi.mock("./auto-gen-dialog", () => ({
  AutoGenDialog: () => null
}));

vi.mock("./flashcard-style-picker", () => ({
  FlashcardStylePickerModal: () => null
}));

vi.mock("../../_components/ads/ad-slot", () => ({
  AdSlot: () => {
    adSlotRenderMock();
    return null;
  }
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const SAMPLE_REVENGE_QUEUE = {
  questions: [
    {
      questionId: "q-revenge-1",
      prompt: "部長に報告する際、最も適切な表現はどれですか。",
      scenario: "会議後の報告",
      skillTag: "keigo",
      options: [
        { key: "A", text: "ご報告いたします", originalKey: "A" },
        { key: "B", text: "報告してあげる", originalKey: "B" }
      ],
      yourAnswer: "B"
    }
  ],
  totalPending: 2
};

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function mockFlashcardsApis(dueCount: number) {
  const dueItems = Array.from({ length: dueCount }, (_, idx) => ({ id: `due-${idx + 1}` }));
  vi.mocked(learnerApiFetch).mockImplementation(async (path) => {
    const url = String(path);
    if (url.startsWith("/api/flashcards/styles/active")) {
      return { ok: true, json: async () => ({ config: null }) } as Response;
    }
    if (url.startsWith("/api/flashcards/reviews/due")) {
      return { ok: true, json: async () => dueItems } as Response;
    }
    if (url.startsWith("/api/quiz/revenge/queue")) {
      return { ok: true, json: async () => SAMPLE_REVENGE_QUEUE } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
}

async function renderPage({
  initialMain = "library",
  locale = "vi"
}: {
  initialMain?: "review" | "library";
  locale?: "vi" | "en";
} = {}): Promise<HTMLDivElement> {
  const t = locale === "en" ? enMessages : viMessages;
  const container = document.createElement("div");
  document.body.append(container);
  host = container;
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <FlashcardsPageClient
        adLabels={t.adSurface}
        cardgenLabels={t.cardgen}
        deckLabels={t.decks}
        flashcardLabels={t.flashcards}
        initialMain={initialMain}
        locale={locale}
        reviewSessionLabels={t.reviewSession}
      />
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return container;
}

function dueApiCalls() {
  return vi
    .mocked(learnerApiFetch)
    .mock.calls.filter(([path]) => String(path).startsWith("/api/flashcards/reviews/due"));
}

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  host?.remove();
  root = null;
  host = null;
  searchParamsRef.value = "";
  vi.clearAllMocks();
});

describe("FlashcardsPageClient review-first default & revenge widget embed (WEB-445)", () => {
  it("opens Review tab by default with localized RevengeModeWidget at the top when no ?tab param and due > 0, without extra due API calls", async () => {
    searchParamsRef.value = "";
    mockFlashcardsApis(3);

    await renderPage({ initialMain: "library", locale: "vi" });

    expect(
      host?.querySelector('[data-testid="deck-browser-mock"]'),
      "default route with due > 0 must not remain on Library deck list"
    ).toBeNull();
    expect(
      host?.textContent,
      "default route with due > 0 must open the Review tab view"
    ).toContain(viMessages.reviewSession.entryTitle);
    expect(dueApiCalls(), "must reuse the existing due-count fetch without adding API calls").toHaveLength(1);

    const panel = host?.querySelector('[role="tabpanel"]');
    expect(panel, "review tabpanel must render").not.toBeNull();
    const revengeHeading = Array.from(panel?.querySelectorAll("h3") ?? []).find((el) =>
      el.textContent?.includes("Ôn lại câu BJT làm sai")
    );
    const srsHeading = Array.from(panel?.querySelectorAll("h3") ?? []).find((el) =>
      el.textContent?.includes(viMessages.reviewSession.entryTitle)
    );
    expect(
      revengeHeading,
      "localized RevengeModeWidget heading must be embedded inside the Review tab"
    ).toBeTruthy();
    expect(srsHeading, "SRS review entry heading must render in Review tab").toBeTruthy();
    expect(
      Boolean(
        revengeHeading &&
          srsHeading &&
          revengeHeading.compareDocumentPosition(srsHeading) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      "RevengeModeWidget must appear above the SRS review entry block"
    ).toBe(true);
    expect(panel?.textContent).not.toContain("Revenge Mode");
    expect(panel?.textContent).not.toContain("Trả thù ngay");
    expect(
      adSlotRenderMock,
      "library AdSlot must never mount on a review-first default load when due > 0"
    ).not.toHaveBeenCalled();
  });

  it("opens Library view by default when no ?tab param and due === 0", async () => {
    searchParamsRef.value = "";
    mockFlashcardsApis(0);

    await renderPage({ initialMain: "library", locale: "vi" });

    expect(
      host?.querySelector('[data-testid="deck-browser-mock"]'),
      "default route with 0 due cards must stay on Library deck browser"
    ).not.toBeNull();
    expect(dueApiCalls()).toHaveLength(1);
    expect(adSlotRenderMock).toHaveBeenCalled();
  });

  it("honors explicit ?tab=library even when due > 0", async () => {
    searchParamsRef.value = "tab=library";
    mockFlashcardsApis(4);

    await renderPage({ initialMain: "library", locale: "vi" });

    expect(
      host?.querySelector('[data-testid="deck-browser-mock"]'),
      "explicit ?tab=library must win over due > 0 auto-review default"
    ).not.toBeNull();
  });

  it("keeps Library mounted after ?cloneToken is stripped post-clone even when due > 0", async () => {
    searchParamsRef.value = "cloneToken=shared-token-123";
    mockFlashcardsApis(4);

    await renderPage({ initialMain: "library", locale: "vi" });

    expect(
      host?.querySelector('[data-testid="deck-browser-mock"]'),
      "shared-deck cloneToken must keep Library mounted"
    ).not.toBeNull();

    // Simulate DeckBrowser calling router.replace(pathname) after clone succeeds
    searchParamsRef.value = "";
    await act(async () => {
      root!.render(
        <FlashcardsPageClient
          adLabels={viMessages.adSurface}
          cardgenLabels={viMessages.cardgen}
          deckLabels={viMessages.decks}
          flashcardLabels={viMessages.flashcards}
          initialMain="library"
          locale="vi"
          reviewSessionLabels={viMessages.reviewSession}
        />
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      host?.querySelector('[data-testid="deck-browser-mock"]'),
      "stripping cloneToken after clone must not yank learner out of Library into Review"
    ).not.toBeNull();
  });

  it("honors explicit ?tab=review and valid ?deckId even when due === 0", async () => {
    searchParamsRef.value = "tab=review";
    mockFlashcardsApis(0);

    await renderPage({ initialMain: "review", locale: "en" });

    expect(host?.querySelector('[data-testid="deck-browser-mock"]')).toBeNull();
    expect(host?.textContent).toContain(enMessages.reviewSession.entryTitle);
    expect(host?.textContent).toContain("Review Missed Questions");
    expect(host?.textContent).not.toContain("Revenge Mode");

    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    host?.remove();
    host = null;

    searchParamsRef.value = "deckId=11111111-1111-4111-8111-111111111111";
    mockFlashcardsApis(0);
    const deckContainer = await renderPage({ initialMain: "review", locale: "vi" });
    expect(deckContainer.querySelector('[data-testid="deck-browser-mock"]')).toBeNull();
    expect(deckContainer.textContent).toContain(viMessages.reviewSession.entryTitle);
  });

  it("does not override a manual Library tab click made while the due fetch is still pending", async () => {
    searchParamsRef.value = "";
    let resolveDue: ((value: Response) => void) | null = null;
    vi.mocked(learnerApiFetch).mockImplementation((path) => {
      const url = String(path);
      if (url.startsWith("/api/flashcards/styles/active")) {
        return Promise.resolve({ ok: true, json: async () => ({ config: null }) } as Response);
      }
      if (url.startsWith("/api/flashcards/reviews/due")) {
        return new Promise<Response>((resolve) => {
          resolveDue = resolve;
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as Response);
    });

    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <FlashcardsPageClient
          adLabels={viMessages.adSurface}
          cardgenLabels={viMessages.cardgen}
          deckLabels={viMessages.decks}
          flashcardLabels={viMessages.flashcards}
          initialMain="library"
          locale="vi"
          reviewSessionLabels={viMessages.reviewSession}
        />
      );
    });

    // While due fetch is still pending, neither Library AdSlot nor DeckBrowser should flash
    expect(adSlotRenderMock).not.toHaveBeenCalled();
    expect(host.querySelector('[data-testid="deck-browser-mock"]')).toBeNull();

    // Learner clicks My Sets before due fetch resolves
    const mySetsTab = Array.from(host.querySelectorAll('[role="tab"]')).find((btn) =>
      btn.textContent?.includes(viMessages.flashcards.libraryNavMySets)
    ) as HTMLButtonElement | undefined;
    expect(mySetsTab).toBeTruthy();
    await act(async () => {
      mySetsTab!.click();
    });

    // Due fetch now resolves with 5 due cards — manual choice must win
    await act(async () => {
      resolveDue!({
        ok: true,
        json: async () => [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }]
      } as Response);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(
      host.querySelector('[data-testid="deck-browser-mock"]'),
      "resolving due > 0 must not override learner's manual switch to Library"
    ).not.toBeNull();
  });

  it("syncs explicit ?tab=library when learner switches from Review to Library", async () => {
    searchParamsRef.value = "";
    mockFlashcardsApis(2);

    await renderPage({ initialMain: "library", locale: "vi" });
    expect(host?.querySelector('[data-testid="deck-browser-mock"]')).toBeNull();

    const mySetsTab = Array.from(host?.querySelectorAll('[role="tab"]') ?? []).find((btn) =>
      btn.textContent?.includes(viMessages.flashcards.libraryNavMySets)
    ) as HTMLButtonElement | undefined;
    expect(mySetsTab, "desktop rail must include My Sets tab").toBeTruthy();

    await act(async () => {
      mySetsTab!.click();
    });

    expect(host?.querySelector('[data-testid="deck-browser-mock"]')).not.toBeNull();
    expect(replaceMock).toHaveBeenCalledWith("/vi/flashcards?tab=library", { scroll: false });
  });
});
