"use client";

export interface JapaneseSpeechOptions {
  lang?: string;
  onEnd?: () => void;
  onError?: () => void;
  onStart?: () => void;
  pitch?: number;
  rate?: number;
}

const PREFERRED_VOICE_PATTERNS = [
  /nanami/u,
  /haruka/u,
  /ayumi/u,
  /kyoko/u,
  /o-ren/u,
  /google.*(?:日本語|japanese)/u,
  /(?:日本語|japanese).*google/u
];

const LOW_CLARITY_VOICE_PATTERNS = [/otoya/u, /ichiro/u, /takumi/u, /keita/u, /hattori/u];

let currentSpeechRequest = 0;

function japaneseVoiceScore(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLocaleLowerCase("en-US");
  if (!lang.startsWith("ja")) return Number.NEGATIVE_INFINITY;

  const name = voice.name.normalize("NFKC").toLocaleLowerCase("en-US");
  let score = lang === "ja-jp" ? 40 : 30;
  score += voice.localService ? 12 : 0;
  score += voice.default ? 2 : 0;

  const preferredIndex = PREFERRED_VOICE_PATTERNS.findIndex((pattern) => pattern.test(name));
  if (preferredIndex >= 0) score += 100 - preferredIndex * 5;
  if (LOW_CLARITY_VOICE_PATTERNS.some((pattern) => pattern.test(name))) score -= 100;
  return score;
}

/** Pick a clear Japanese voice without depending on the browser's arbitrary list order. */
export function selectJapaneseVoice(
  voices: readonly SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  return voices
    .map((voice, index) => ({ index, score: japaneseVoiceScore(voice), voice }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.voice;
}

export function cancelJapaneseSpeech(): void {
  currentSpeechRequest += 1;
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

/** Consistent browser fallback; recorded native-speaker audio remains preferable. */
export function speakJapanese(
  text: string,
  options: JapaneseSpeechOptions = {}
): SpeechSynthesisUtterance | null {
  const cleanText = text.trim();
  if (
    !cleanText ||
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    options.onError?.();
    return null;
  }

  const requestId = ++currentSpeechRequest;
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = options.lang ?? "ja-JP";
  utterance.rate = options.rate ?? 0.86;
  utterance.pitch = options.pitch ?? 1.08;
  utterance.volume = 1;

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onError?.();

  const start = () => {
    if (requestId !== currentSpeechRequest) return;
    const voice = selectJapaneseVoice(synthesis.getVoices());
    if (voice) utterance.voice = voice;
    synthesis.speak(utterance);
  };

  // Chromium may expose an empty voice list briefly after page load. Give it a
  // short window to load installed voices before falling back.
  const initialVoices = synthesis.getVoices();
  if (
    initialVoices.length === 0 &&
    typeof synthesis.addEventListener === "function" &&
    typeof synthesis.removeEventListener === "function"
  ) {
    let started = false;
    const startOnce = () => {
      if (started) return;
      started = true;
      synthesis.removeEventListener("voiceschanged", startOnce);
      start();
    };
    synthesis.addEventListener("voiceschanged", startOnce, { once: true });
    window.setTimeout(startOnce, 180);
  } else {
    start();
  }
  return utterance;
}
