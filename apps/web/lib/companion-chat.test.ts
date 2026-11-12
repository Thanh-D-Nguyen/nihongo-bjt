import type { CompanionMessage } from "@nihongo-bjt/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCompanionChatHistory,
  buildCompanionChatRequest,
  requestCompanionChat,
} from "./companion-chat";

vi.mock("./learner-api", () => ({
  learnerApiFetch: vi.fn(),
}));

import { learnerApiFetch } from "./learner-api";

const mockFetch = vi.mocked(learnerApiFetch);

function msg(partial: Partial<CompanionMessage>): CompanionMessage {
  return {
    id: "m1",
    type: "hint",
    sender: "bot",
    textJa: "",
    textVi: "",
    timestamp: 0,
    ...partial,
  };
}

describe("buildCompanionChatHistory", () => {
  it("maps learner turns and Shiba chat replies, skipping UI chrome", () => {
    const messages: CompanionMessage[] = [
      msg({ type: "greeting", textJa: "こんにちは！", textVi: "Xin chào!" }),
      msg({ type: "tip", textJa: "ヒント", textVi: "Mẹo" }),
      msg({ sender: "user", type: "context_aware", textJa: "「ありがとう」の丁寧な言い方は？", textVi: "「ありがとう」の丁寧な言い方は？" }),
      msg({ type: "hint", textJa: "「ありがとうございます」です。", textVi: "Là「ありがとうございます」." }),
      msg({ type: "celebration", textJa: "すごい！", textVi: "Giỏi!" }),
    ];
    expect(buildCompanionChatHistory(messages, "vi")).toEqual([
      { role: "user", content: "「ありがとう」の丁寧な言い方は？" },
      { role: "assistant", content: "Là「ありがとうございます」." },
    ]);
    expect(buildCompanionChatHistory(messages, "ja")).toEqual([
      { role: "user", content: "「ありがとう」の丁寧な言い方は？" },
      { role: "assistant", content: "「ありがとうございます」です。" },
    ]);
  });

  it("caps history at the most recent 20 turns", () => {
    const messages: CompanionMessage[] = [];
    for (let i = 0; i < 30; i++) {
      messages.push(msg({ sender: "user", type: "context_aware", textJa: `q${i}`, textVi: `q${i}` }));
    }
    const history = buildCompanionChatHistory(messages, "vi");
    expect(history).toHaveLength(20);
    expect(history[0]?.content).toBe("q10");
  });
});

describe("buildCompanionChatRequest", () => {
  it("trims the outgoing message and carries locale", () => {
    const req = buildCompanionChatRequest([], "vi", "  keigo là gì?  ");
    expect(req).toEqual({ message: "keigo là gì?", history: [], locale: "vi" });
  });
});

describe("requestCompanionChat", () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it("returns the reply text on success", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ reply: "「承知しました」を使いましょう。", model: "qwen2.5:7b" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const reply = await requestCompanionChat({ message: "hi", history: [], locale: "ja" });
    expect(reply).toBe("「承知しました」を使いましょう。");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/companion/chat",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns null when the endpoint is not configured (503)", async () => {
    mockFetch.mockResolvedValue(new Response("{}", { status: 503 }));
    await expect(
      requestCompanionChat({ message: "hi", history: [], locale: "vi" }),
    ).resolves.toBeNull();
  });

  it("returns null on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    await expect(
      requestCompanionChat({ message: "hi", history: [], locale: "vi" }),
    ).resolves.toBeNull();
  });
});
