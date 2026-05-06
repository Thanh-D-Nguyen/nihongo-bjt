"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useRef, useState } from "react";

/* ─── Voice Search (Web Speech API) ─── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionAny = any;

export function VoiceSearchButton({
  onResult,
  className
}: {
  onResult: (text: string) => void;
  className?: string;
}) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionAny>(null);

  const toggle = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const w = window as unknown as Record<string, unknown>;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new (SpeechRecognitionCtor as new () => SpeechRecognitionAny)();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: { results: { 0: { 0: { transcript: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        onResult(transcript);
      }
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, onResult]);

  // Check if browser supports speech recognition
  const supported = typeof window !== "undefined" && (
    "SpeechRecognition" in window ||
    "webkitSpeechRecognition" in window
  );

  if (!supported) return null;

  return (
    <button
      type="button"
      className={cn(
        "flex items-center justify-center rounded-md border border-ink/10 p-1.5 transition-colors",
        listening ? "bg-sakura/10 border-sakura text-sakura" : "text-muted hover:text-ink hover:border-ink/20",
        className
      )}
      onClick={toggle}
      title={listening ? "Đang nghe..." : "Tìm bằng giọng nói"}
    >
      <MicIcon listening={listening} />
    </button>
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

  const handleFile = useCallback(async (file: File) => {
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
  }, [onResult]);

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
          "flex items-center justify-center rounded-md border border-ink/10 p-1.5 text-muted transition-colors hover:text-ink hover:border-ink/20",
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
        "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-purple-300 bg-purple-50 text-purple-600"
          : "border-ink/10 text-muted hover:text-ink hover:border-ink/20",
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={listening ? "animate-pulse" : ""}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
