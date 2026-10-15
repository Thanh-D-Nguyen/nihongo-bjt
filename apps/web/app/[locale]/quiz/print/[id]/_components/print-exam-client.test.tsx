// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import viMessages from "../../../../../../messages/vi.json";
import { PrintExamClient } from "./print-exam-client";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host?.remove();
  host = null;
  vi.unstubAllGlobals();
});

describe("PrintExamClient", () => {
  it("retries a failed request, renders the printable exam, and reveals its answer key", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "exam-1",
        level: "J2",
        sections: [{
          code: "LC1",
          displayOrder: 1,
          id: "section-1",
          questions: [{
            correctKey: "B",
            explanationVi: "Đáp án B",
            id: "question-1",
            number: 1,
            options: [{ key: "A", text: "Sai" }, { key: "B", text: "Đúng" }],
            prompt: "Chọn đáp án phù hợp"
          }],
          titleVi: "Nghe hiểu"
        }],
        slug: "practice-j2",
        timeLimitSeconds: 2700,
        titleVi: "Đề luyện J2",
        totalQuestions: 1,
        type: "practice"
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(createElement(PrintExamClient, {
        examId: "exam/1",
        labels: viMessages.quiz,
        locale: "vi"
      }));
    });
    expect(host.textContent).toContain(viMessages.quiz.print.loadError);

    await act(async () => {
      host?.querySelector("button")?.click();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/quiz/templates/exam%2F1/printable", {
      cache: "no-store",
      credentials: "include"
    });
    expect(host.textContent).toContain("Đề luyện J2");
    expect(host.textContent).toContain("Chọn đáp án phù hợp");
    expect(host.querySelector(".print\\:hidden")).not.toBeNull();

    await act(async () => {
      (host?.querySelector("input[type=checkbox]") as HTMLInputElement).click();
    });
    expect(host.querySelectorAll(".border-positive")).toHaveLength(1);
  });
});
