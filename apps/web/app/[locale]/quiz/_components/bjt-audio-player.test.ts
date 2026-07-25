/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import { speakJapaneseWithBrowserTts, stripDirections } from "./bjt-audio-player";

class MockUtterance {
  lang = "";
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {}
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("browser Japanese TTS", () => {
  it("normalizes stage directions before speaking", () => {
    expect(stripDirections("【会議】\n（電話）\n担当者：承知しました。")).toBe(
      "担当者：承知しました。"
    );
  });

  it("uses a Japanese voice and production speaking rate", () => {
    const voice = { lang: "ja-JP", name: "Japanese" } as SpeechSynthesisVoice;
    const speak = vi.fn((utterance: MockUtterance) => {
      utterance.onstart?.();
      utterance.onend?.();
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel: vi.fn(), getVoices: () => [voice], speak }
    });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    const onStart = vi.fn();
    const onEnd = vi.fn();

    speakJapaneseWithBrowserTts("【指示】確認してください。", { onEnd, onStart });

    expect(speak).toHaveBeenCalledOnce();
    const utterance = speak.mock.calls[0]?.[0];
    expect(utterance).toMatchObject({
      lang: "ja-JP",
      pitch: 1.08,
      rate: 0.86,
      text: "確認してください。",
      voice
    });
    expect(onStart).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });
});
