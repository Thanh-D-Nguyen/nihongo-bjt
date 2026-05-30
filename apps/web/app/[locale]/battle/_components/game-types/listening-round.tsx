"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameTypeRoundProps } from "./shared-props";

const MAX_REPLAYS = 2;

function parseBrowserTtsUrl(audioUrl: string | null | undefined): { lang: string; rate: number; text: string } | null {
  if (!audioUrl?.startsWith("tts://")) return null;
  try {
    const url = new URL(audioUrl);
    const text = url.searchParams.get("text")?.trim() ?? "";
    if (!text) return null;
    const rate = Number.parseFloat(url.searchParams.get("rate") ?? "0.9");
    return {
      lang: url.searchParams.get("lang") ?? "ja-JP",
      rate: Number.isFinite(rate) ? rate : 0.9,
      text
    };
  } catch {
    return null;
  }
}

/**
 * Listening Challenge: Audio-only mode.
 * Prompt text is hidden. Audio auto-plays. Limited replays.
 * Focus on ear training — visual waveform animation.
 */
export function ListeningRound({
  answerPending,
  answerResult,
  canAnswer,
  onSubmitAnswer,
  round,
  selectedOptionKey
}: GameTypeRoundProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const audioSrc = round.question.audioUrl;
  const browserTts = parseBrowserTtsUrl(audioSrc);
  const fileAudioSrc = browserTts ? null : audioSrc;
  const speechText = browserTts?.text ?? round.question.audioScript?.trim() ?? "";
  const speechLang = browserTts?.lang ?? "ja-JP";
  const speechRate = browserTts?.rate ?? 0.9;
  const hasPlayableAudio = Boolean(fileAudioSrc || speechText);

  const playSpeech = useCallback((countPlay: boolean) => {
    if (!speechText || typeof window === "undefined" || !window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = speechLang;
    utterance.rate = speechRate;
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.startsWith("ja"));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      setPlaying(true);
      if (countPlay) setPlayCount((count) => count + 1);
    };
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  }, [speechLang, speechRate, speechText]);

  const playAudio = useCallback((countPlay: boolean) => {
    if (fileAudioSrc && audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play().then(() => {
        setPlaying(true);
        if (countPlay) setPlayCount((count) => count + 1);
      }).catch(() => {
        void playSpeech(countPlay);
      });
      return;
    }
    void playSpeech(countPlay);
  }, [fileAudioSrc, playSpeech]);

  // Auto-play on new round
  useEffect(() => {
    setPlaying(false);
    setPlayCount(0);
    setShowHint(false);
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    if (hasPlayableAudio) {
      playAudio(true);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
      utteranceRef.current = null;
    };
  }, [hasPlayableAudio, playAudio, round.roundIndex]);

  const replay = () => {
    if (!hasPlayableAudio || playCount >= MAX_REPLAYS || playing) return;
    playAudio(true);
  };

  const replaysLeft = MAX_REPLAYS - playCount;

  return (
    <div className="space-y-4">
      {/* Audio-first header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>🎧</span>
          <span className="text-xs font-black uppercase text-cyan-700">Listening Challenge</span>
        </div>
        {!answerResult && (
          <button
            className="text-[10px] font-bold text-muted hover:text-ink underline"
            onClick={() => setShowHint(!showHint)}
            type="button"
          >
            {showHint ? "Hide text" : "Show hint"}
          </button>
        )}
      </div>

      {/* Waveform / Audio player area */}
      <div className="relative flex flex-col items-center gap-4 rounded-2xl border border-cyan-200/50 bg-gradient-to-b from-cyan-50/80 to-sky-50/40 p-6">
        {/* Waveform animation */}
        <div className="flex items-end gap-1 h-16" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-300 ${
                playing ? "bg-cyan-500" : "bg-cyan-200"
              }`}
              style={{
                height: playing
                  ? `${20 + Math.sin((Date.now() / 200 + i) * 0.5) * 30 + Math.random() * 20}%`
                  : `${15 + Math.sin(i * 0.7) * 10}%`,
                animationDelay: `${i * 50}ms`
              }}
            />
          ))}
        </div>

        {/* Play / Replay button */}
        <div className="flex items-center gap-3">
          <button
            className={`grid h-14 w-14 place-items-center rounded-full shadow-md transition-all ${
              playing
                ? "bg-cyan-600 text-white shadow-cyan-400/30"
                : hasPlayableAudio && replaysLeft > 0
                  ? "bg-white text-cyan-700 ring-2 ring-cyan-200 hover:bg-cyan-50"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            disabled={!hasPlayableAudio || (replaysLeft <= 0 && !playing)}
            onClick={replay}
            type="button"
            aria-label={playing ? "Playing..." : "Replay audio"}
          >
            {playing ? (
              <svg className="h-5 w-5 animate-pulse" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="4" height="12" rx="1"/>
                <rect x="9" y="2" width="4" height="12" rx="1"/>
              </svg>
            ) : (
              <svg className="h-5 w-5 ml-0.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.5v11a.5.5 0 00.77.42l9-5.5a.5.5 0 000-.84l-9-5.5A.5.5 0 004 2.5z"/>
              </svg>
            )}
          </button>
          <div className="text-center">
            <p className="text-sm font-black text-cyan-800">Listen carefully</p>
            <p className="text-[11px] font-semibold text-cyan-600/80">
              {replaysLeft > 0 ? `${replaysLeft} replay${replaysLeft > 1 ? "s" : ""} left` : "No replays left"}
            </p>
          </div>
        </div>

        {fileAudioSrc && (
          <audio
            ref={audioRef}
            src={fileAudioSrc}
            preload="auto"
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            onError={() => {
              if (speechText) {
                playSpeech(false);
              }
            }}
          />
        )}
      </div>

      {/* Hidden prompt (hint) */}
      {showHint && (
        <p className="rounded-xl border border-dashed border-ink/15 bg-paper/50 px-3 py-2 text-sm font-medium text-muted italic">
          💡 {round.question.prompt}
        </p>
      )}

      {/* Answer options */}
      <div className="grid gap-2 sm:grid-cols-2">
        {round.question.options.map((option) => {
          const picked = selectedOptionKey === option.optionKey;
          const correct = answerResult?.correctOptionKey === option.optionKey;
          const wrong = picked && answerResult && !answerResult.userCorrect;
          return (
            <button
              key={option.optionKey}
              className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-bold leading-5 transition-all ${
                correct
                  ? "border-leaf/30 bg-leaf/10 text-leaf ring-2 ring-leaf/20"
                  : wrong
                    ? "border-red-300 bg-red-50 text-red-700 ring-2 ring-red-200"
                    : picked
                      ? "border-cyan-300 bg-cyan-50 text-cyan-800"
                      : "border-ink/10 bg-white text-ink hover:border-cyan-200 hover:bg-cyan-50/50 active:scale-[0.97]"
              } ${answerPending || answerResult ? "pointer-events-none" : ""}`}
              disabled={!canAnswer}
              onClick={() => onSubmitAnswer(option.optionKey)}
              type="button"
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
