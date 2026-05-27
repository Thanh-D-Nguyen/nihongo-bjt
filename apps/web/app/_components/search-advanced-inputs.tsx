"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useRef, useState } from "react";

/* ─── Voice Search (Web Speech API) ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionAny = any;

type VoiceError = "not-allowed" | "no-speech" | "network" | "generic" | null;

const speechLangMap: Record<string, string> = {
  ja: "ja-JP",
  vi: "vi-VN",
  en: "en-US",
};

export interface VoiceSearchLabels {
  listening?: string;
  title?: string;
  permissionDenied?: string;
  noSpeech?: string;
  networkError?: string;
  genericError?: string;
}

const defaultVoiceLabels: Required<VoiceSearchLabels> = {
  listening: "Đang nghe...",
  title: "Tìm bằng giọng nói",
  permissionDenied: "Vui lòng cho phép microphone",
  noSpeech: "Không nghe thấy. Thử lại.",
  networkError: "Lỗi mạng. Thử lại.",
  genericError: "Không nhận giọng. Thử lại.",
};

export function VoiceSearchButton({
  onResult,
  className,
  locale = "ja",
  labels: labelsProp,
}: {
  onResult: (text: string) => void;
  className?: string;
  locale?: string;
  labels?: VoiceSearchLabels;
}) {
  const labels = { ...defaultVoiceLabels, ...labelsProp };
  const [listening, setListening] = useState(false);
  const [speechSupportChecked, setSpeechSupportChecked] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [error, setError] = useState<VoiceError>(null);
  const recognitionRef = useRef<SpeechRecognitionAny>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setSpeechSupported("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setSpeechSupportChecked(true);
  }, []);

  // Auto-clear error after 3s
  useEffect(() => {
    if (!error) return;
    errorTimerRef.current = setTimeout(() => setError(null), 3000);
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [error]);

  const toggle = useCallback(() => {
    setError(null);

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const w = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new (SpeechRecognitionCtor as new () => SpeechRecognitionAny)();
    recognition.lang = speechLangMap[locale] ?? "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let gotResult = false;
    let gotError = false;

    recognition.onresult = (event: { results: { 0: { 0: { transcript: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript;
      gotResult = true;
      if (transcript) {
        onResult(transcript);
      }
      setListening(false);
    };

    recognition.onerror = (event: { error?: string }) => {
      gotError = true;
      setListening(false);
      const code = event.error ?? "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("not-allowed");
      } else if (code === "no-speech") {
        setError("no-speech");
      } else if (code === "network") {
        setError("network");
      } else if (code === "aborted") {
        // User cancelled — no error
        gotError = false;
      } else {
        setError("generic");
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (!gotResult && !gotError) {
        // Recognition ended without result and without explicit error (e.g. silence timeout)
        setError("no-speech");
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("generic");
    }
  }, [listening, onResult, locale]);

  if (speechSupportChecked && !speechSupported) return null;

  const errorMessage =
    error === "not-allowed"
      ? labels.permissionDenied
      : error === "no-speech"
        ? labels.noSpeech
        : error === "network"
          ? labels.networkError
          : error === "generic"
            ? labels.genericError
            : null;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={cn(
          "flex min-h-12 min-w-12 items-center justify-center rounded-2xl border transition-all duration-150 active:scale-95",
          listening
            ? "border-sakura bg-sakura/10 text-sakura shadow-md shadow-sakura/10"
            : error
              ? "border-sakura/40 text-sakura"
              : "border-ink/10 bg-surface text-muted shadow-sm hover:border-ink/20 hover:text-ink hover:shadow-md",
          className
        )}
        onClick={toggle}
        disabled={!speechSupported}
        title={listening ? labels.listening : labels.title}
        aria-label={listening ? labels.listening : labels.title}
      >
        <MicIcon listening={listening} />
      </button>
      {errorMessage && (
        <span
          role="alert"
          className="absolute right-0 top-full z-30 mt-1.5 w-max max-w-[200px] rounded-lg border border-sakura/20 bg-paper px-2.5 py-1.5 text-[11px] font-medium text-sakura shadow-lg"
        >
          {errorMessage}
        </span>
      )}
    </div>
  );
}

/* ─── Image OCR Search (stub — needs OCR provider) ─── */
export function ImageSearchButton({
  onResult,
  className
}: {
  onResult: (text: string) => void;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setProcessing(true);
      try {
        // Stub: In production, send to OCR provider (Tesseract.js, Google Vision, etc.)
        // For now, create a placeholder notification
        console.info("[OCR] Image uploaded for text extraction:", file.name);
        // TODO: Replace with real OCR provider call
        // const text = await ocrProvider.extractText(file);
        // onResult(text);
        onResult(""); // Placeholder
      } finally {
        setProcessing(false);
      }
    },
    [onResult]
  );

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={cn(
          "flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-ink/10 bg-surface text-muted shadow-sm transition-all duration-150 hover:border-ink/20 hover:text-ink hover:shadow-md active:scale-95",
          processing && "opacity-50 pointer-events-none",
          className
        )}
        onClick={() => fileRef.current?.click()}
        title="Tìm bằng hình ảnh (OCR)"
        disabled={processing}
      >
        <CameraIcon />
      </button>
    </>
  );
}

/* ─── AI Search Mode Toggle ─── */
export function AiSearchToggle({
  active,
  onToggle,
  className
}: {
  active: boolean;
  onToggle: (active: boolean) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-150 active:scale-95",
        active
          ? "border-purple-300 bg-purple-50 text-purple-600 shadow-sm shadow-purple-100"
          : "border-ink/10 bg-surface text-muted shadow-sm hover:text-ink hover:border-ink/20 hover:shadow-md",
        className
      )}
      onClick={() => onToggle(!active)}
      title={active ? "Tắt AI search" : "Bật AI search"}
    >
      <SparkleIcon />
      AI
    </button>
  );
}

/* ─── Icons ─── */
function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={listening ? "animate-pulse" : ""}
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
    </svg>
  );
}
