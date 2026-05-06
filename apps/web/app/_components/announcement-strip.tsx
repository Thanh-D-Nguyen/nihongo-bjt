"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { IconClose, IconNotice } from "./app-icons";

/* ── Types ── */
type AnnouncementType = "info" | "event" | "promo";

interface Announcement {
  id: string;
  type: AnnouncementType;
  message: string;
  href?: string;
}

const NOTICE_TONE: Record<AnnouncementType, string> = {
  event: "bg-amber-100 text-amber-700",
  info: "bg-accent/10 text-accent",
  promo: "bg-violet-100 text-violet-700",
};

/* ── Announcements — fetched from API ── */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/u, "");

const STORAGE_KEY = "nihongo-dismissed-announcements";
const ROTATE_MS = 8_000;

function getDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage full — ignore */
  }
}

/* ── Component ── */
export function AnnouncementStrip() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch announcements from API on mount
  useEffect(() => {
    setDismissed(getDismissed());
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/announcements`);
        if (res.ok) {
          const data = (await res.json()) as Announcement[];
          if (!cancelled && data.length > 0) {
            setAnnouncements(data);
            return;
          }
        }
      } catch { /* network error */ }
      if (!cancelled) setAnnouncements([]);
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(
    () => announcements.filter((a) => !dismissed.has(a.id)),
    [dismissed, announcements],
  );

  // Auto-rotate
  useEffect(() => {
    if (visible.length <= 1 || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % visible.length);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible.length, paused]);

  const dismiss = useCallback(
    (id: string) => {
      const next = new Set(dismissed);
      next.add(id);
      setDismissed(next);
      persistDismissed(next);
      setActiveIdx(0);
    },
    [dismissed],
  );

  if (visible.length === 0) return null;

  const current = visible[activeIdx % visible.length];
  if (!current) return null;

  const Content = current.href ? "a" : "span";
  const contentProps = current.href ? { href: current.href } : {};

  return (
    <div
      className="flex items-center justify-center gap-2 border-b border-accent/10 bg-accent/5 px-4 py-2 text-xs text-ink/80"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="status"
      aria-live="polite"
    >
      <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full ${NOTICE_TONE[current.type]}`}>
        <IconNotice aria-hidden size={16} />
      </span>

      <Content
        className={current.href ? "underline-offset-2 hover:underline" : undefined}
        {...contentProps}
      >
        {current.message}
      </Content>

      {/* Dismiss button */}
      <button
        aria-label="Đóng"
        className="ml-1 shrink-0 rounded p-0.5 text-muted/60 transition-colors hover:text-ink"
        onClick={() => dismiss(current.id)}
        type="button"
      >
        <IconClose aria-hidden size={16} />
      </button>

      {/* Page dots (when >1) */}
      {visible.length > 1 && (
        <span className="ml-1 flex gap-1">
          {visible.map((_, i) => (
            <span
              className={`inline-block h-1 w-1 rounded-full transition-colors ${
                i === activeIdx % visible.length ? "bg-accent" : "bg-ink/15"
              }`}
              key={i}
            />
          ))}
        </span>
      )}
    </div>
  );
}
