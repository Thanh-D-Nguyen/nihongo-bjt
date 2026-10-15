// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import FeedbackPage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "vi" }) }));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("learner feedback form", () => {
  it("uses clear English success copy", () => {
    expect(en.feedbackPage.success, "English feedback confirmation should be grammatical").toBe("Thank you for your feedback! We'll review it soon.");
  });

  it("associates every localized field label and prevents duplicate submits while saving", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => root.render(<FeedbackPage />));
    const controls = [...container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea")];
    expect(controls).toHaveLength(4);
    const touchControls = [...container.querySelectorAll("main input, main select, main button")];
    expect(touchControls.every((control) => control.classList.contains("min-h-12")), "mobile feedback controls must be at least 48px tall").toBe(true);
    expect(controls.every((control) => control.labels?.length === 1), "all feedback fields must have associated labels").toBe(true);

    const message = container.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(message, "A useful report");
      message.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const form = container.querySelector("form")!;
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await act(async () => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector("button")?.disabled).toBe(true);
  });

  it("keeps entered values and shows an error when the server did not return persisted status 201", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => root.render(<FeedbackPage />));
    const name = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    const message = container.querySelector<HTMLTextAreaElement>("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(name, "Learner");
      name.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(message, "Keep this report");
      message.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(container.textContent, "feedback success requires HTTP 201").not.toContain("Cảm ơn bạn đã góp ý!");
    expect(container.querySelector("textarea")).not.toBeNull();
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("Learner");
    expect(message.value).toBe("Keep this report");
    expect(container.textContent).toContain("Chưa thể gửi. Vui lòng thử lại sau.");
  });

  it("explains when feedback is rate limited", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => root.render(<FeedbackPage />));
    const message = container.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(message, "Please accept this report");
      message.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector("p.text-red-600")?.textContent?.normalize("NFC"), "feedback 429 requires rate limit guidance").toBe("Bạn gửi quá nhanh. Vui lòng đợi một chút rồi thử lại.");
  });
});
