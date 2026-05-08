"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  BJT Audio Player                                                   */
/*  Plays real audio file (audioUrl) or falls back to browser TTS      */
/*  for the audioScript. Limits replays to maxPlays (BJT exam = 2).   */
/* ------------------------------------------------------------------ */

interface BjtAudioPlayerProps {
  /** Pre-recorded audio file URL (MinIO/CDN) */
  audioUrl?: string | null;
  /** Japanese text script for TTS fallback */
  audioScript?: string | null;
  /** Section code to show context label */
  sectionCode?: string | null;
  /** Max number of plays allowed (default: 2, like real BJT) */
  maxPlays?: number;
  /** Labels for i18n */
  labels: {
    listenAudio: string;
    playCount: string;
    ttsNotice: string;
    showScript: string;
    hideScript: string;
    audioSection: string;
  };
}

/** Strip stage directions like 【場面説明】 and （効果音：...） for TTS reading */
export function stripDirections(text: string): string {
  return text
    .replace(/【[^】]*】/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/^\s*\n/gm, "")
    .trim();
}

export function cancelJapaneseSpeechSynthesis(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

/**
 * Browser Japanese TTS (same voice selection as BJT quiz fallback).
 * Call only in response to explicit user action (no autoplay).
 */
export function speakJapaneseWithBrowserTts(
  text: string,
  handlers: { onStart?: () => void; onEnd?: () => void; onError?: () => void }
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    handlers.onError?.();
    return;
  }
  window.speechSynthesis.cancel();
  const cleanText = stripDirections(text);
  if (!cleanText) {
    handlers.onError?.();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "ja-JP";
  utterance.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find((v) => v.lang.startsWith("ja"));
  if (jaVoice) {
    utterance.voice = jaVoice;
  }
  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onError?.();
  window.speechSynthesis.speak(utterance);
}

/** Check if a section code is an audio section (LC or LR) */
export function isAudioSection(sectionCode: string | null | undefined): boolean {
  if (!sectionCode) return false;
  return sectionCode.startsWith("LC") || sectionCode.startsWith("LR");
}

/** Human-readable section type label */
function sectionTypeLabel(code: string | null | undefined): string {
  if (!code) return "";
  if (code.startsWith("LC")) return "聴解";
  if (code.startsWith("LR")) return "聴読解";
  return "";
}

export function BjtAudioPlayer({
  audioUrl,
  audioScript,
  sectionCode,
  maxPlays = 2,
  labels,
}: BjtAudioPlayerProps) {
  const [playCount, setPlayCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const canPlay = playCount < maxPlays;
  const hasAudioFile = Boolean(audioUrl);
  const hasScript = Boolean(audioScript);

  // Reset play count when question changes (audioScript changes)
  useEffect(() => {
    setPlayCount(0);
    setIsPlaying(false);
    setShowScript(false);
    cancelJapaneseSpeechSynthesis();
  }, [audioScript, audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelJapaneseSpeechSynthesis();
    };
  }, []);

  const playAudioFile = useCallback(() => {
    if (!audioUrl || !canPlay) return;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => {
      setIsPlaying(false);
      setPlayCount((c) => c + 1);
    };
    audio.onerror = () => {
      setIsPlaying(false);
      // If audio file fails, fall back to TTS
      if (audioScript) {
        playTTS();
      }
    };
    void audio.play();
  }, [audioUrl, audioScript, canPlay]);

  const playTTS = useCallback(() => {
    if (!audioScript || !canPlay) return;
    speakJapaneseWithBrowserTts(audioScript, {
      onEnd: () => {
        setIsPlaying(false);
        setPlayCount((c) => c + 1);
      },
      onError: () => setIsPlaying(false),
      onStart: () => setIsPlaying(true)
    });
  }, [audioScript, canPlay]);

  const handlePlay = useCallback(() => {
    if (!canPlay || isPlaying) return;
    if (hasAudioFile) {
      playAudioFile();
    } else if (hasScript) {
      playTTS();
    }
  }, [canPlay, isPlaying, hasAudioFile, hasScript, playAudioFile, playTTS]);

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    cancelJapaneseSpeechSynthesis();
    setIsPlaying(false);
  }, []);

  if (!hasAudioFile && !hasScript) return null;

  const sectionLabel = sectionTypeLabel(sectionCode);

  return (
    <div className="mb-4 rounded-xl border border-accent/15 bg-accent/[0.03] p-3 sm:p-4">
      {/* Section indicator */}
      <div className="mb-2.5 flex items-center gap-2">
        {/* Headphone icon */}
        <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wider text-accent">
          {labels.audioSection}{sectionLabel ? ` — ${sectionLabel}` : ""}
        </span>
      </div>

      {/* Play controls */}
      <div className="flex items-center gap-3">
        {isPlaying ? (
          <button
            onClick={handleStop}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-sakura/10 text-sakura transition-colors hover:bg-sakura/20"
            aria-label="Stop"
            type="button"
          >
            {/* Stop icon */}
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handlePlay}
            disabled={!canPlay}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              canPlay
                ? "bg-accent/10 text-accent hover:bg-accent/20"
                : "bg-muted/20 text-muted cursor-not-allowed"
            }`}
            aria-label={labels.listenAudio}
            type="button"
          >
            {/* Play icon */}
            <svg className="h-5 w-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          </button>
        )}

        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-ink">
            {labels.listenAudio}
          </span>
          <span className={`text-[11px] ${canPlay ? "text-muted" : "text-sakura font-medium"}`}>
            {labels.playCount
              .replace("{current}", String(playCount))
              .replace("{max}", String(maxPlays))}
          </span>
        </div>

        {/* Pulsing indicator when playing */}
        {isPlaying && (
          <div className="ml-auto flex items-center gap-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            <span className="h-3 w-3 animate-pulse rounded-full bg-accent/60" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>

      {/* TTS notice (when using TTS, not real audio) */}
      {!hasAudioFile && hasScript && (
        <p className="mt-2 text-[10px] text-muted/70 italic">
          {labels.ttsNotice}
        </p>
      )}

      {/* Script toggle (for study/review — hidden during timed exam if desired) */}
      {hasScript && (
        <div className="mt-2.5 border-t border-accent/10 pt-2">
          <button
            onClick={() => setShowScript(!showScript)}
            className="text-xs font-medium text-accent/70 hover:text-accent transition-colors"
            type="button"
          >
            {showScript ? labels.hideScript : labels.showScript}
          </button>
          {showScript && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-paper/60 p-3 text-xs leading-relaxed text-ink/80 font-sans">
              {audioScript}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
