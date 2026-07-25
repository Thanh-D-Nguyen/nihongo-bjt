// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { selectJapaneseVoice, speakJapanese } from "./japanese-speech";

function voice(
  name: string,
  lang = "ja-JP",
  overrides: Partial<SpeechSynthesisVoice> = {}
): SpeechSynthesisVoice {
  return {
    default: false,
    lang,
    localService: true,
    name,
    voiceURI: name,
    ...overrides
  };
}

describe("Japanese speech", () => {
  it("prefers a curated clear Japanese voice over browser list order", () => {
    const deepDefault = voice("Otoya", "ja-JP", { default: true });
    const clearVoice = voice("Microsoft Nanami Online");
    expect(selectJapaneseVoice([deepDefault, clearVoice])?.name).toBe(clearVoice.name);
  });

  it("ignores non-Japanese voices and keeps a deterministic fallback", () => {
    const firstJapanese = voice("Generic Japanese A");
    expect(
      selectJapaneseVoice([voice("Samantha", "en-US"), firstJapanese, voice("Generic Japanese B")])
    ).toBe(firstJapanese);
  });

  it("uses learning-friendly defaults and the selected voice", () => {
    const selectedVoice = voice("Kyoko");
    const speak = vi.fn();
    const cancel = vi.fn();

    class MockUtterance {
      lang = "";
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onstart: (() => void) | null = null;
      pitch = 1;
      rate = 1;
      text: string;
      voice: SpeechSynthesisVoice | null = null;
      volume = 1;

      constructor(text: string) {
        this.text = text;
      }
    }

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel, getVoices: () => [voice("Otoya"), selectedVoice], speak }
    });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const utterance = speakJapanese("  日本語  ") as unknown as MockUtterance;
    expect(cancel).toHaveBeenCalledOnce();
    expect(utterance.text).toBe("日本語");
    expect(utterance.voice).toBe(selectedVoice);
    expect(utterance.lang).toBe("ja-JP");
    expect(utterance.rate).toBe(0.86);
    expect(utterance.pitch).toBe(1.08);
    expect(speak).toHaveBeenCalledWith(utterance);

    vi.unstubAllGlobals();
  });
});
