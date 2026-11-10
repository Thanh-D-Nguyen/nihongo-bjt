"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

import { IconClose, IconNotice } from "./app-icons";

/* ── Types ── */
type AnnouncementType = "info" | "event" | "promo";
type AnnouncementFormat = "banner" | "modal";
type EffectPreset = "none" | "confetti" | "particles" | "shimmer" | "aurora" | "sakura";
type BgPreset =
  | "default"
  | "gradient-blue"
  | "gradient-violet"
  | "gradient-warm"
  | "gradient-dark"
  | "image-only";
type ShowFrequency = "every_visit" | "once_per_day" | "once_ever";
type Locale = "vi" | "en" | "ja";

interface Announcement {
  id: string;
  type: AnnouncementType;
  format: AnnouncementFormat;
  message: string;
  href?: string;
  titleVi?: string | null;
  titleEn?: string | null;
  titleJa?: string | null;
  bodyVi?: string | null;
  bodyEn?: string | null;
  bodyJa?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  imageUrl?: string | null;
  effect?: EffectPreset;
  bgPreset?: BgPreset;
  allowCloseButton?: boolean;
  allowClickOutside?: boolean;
  dismissDelay?: number;
  showFrequency?: ShowFrequency;
}

const NOTICE_TONE: Record<AnnouncementType, string> = {
  event: "bg-amber-100 text-amber-700",
  info: "bg-accent/10 text-accent",
  promo: "bg-accent/10 text-accent"
};

const COPY: Record<Locale, { promo: string; event: string; info: string; close: string; later: string; more: string }> = {
  vi: { promo: "Khuyến mãi", event: "Sự kiện", info: "Thông báo", close: "Đóng", later: "Để sau", more: "Xem thêm →" },
  en: { promo: "Promotion", event: "Event", info: "Notice", close: "Close", later: "Later", more: "Learn more →" },
  ja: { promo: "キャンペーン", event: "イベント", info: "お知らせ", close: "閉じる", later: "後で", more: "詳しく見る →" }
};

/* ── API + LocalStorage dismiss ── */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/u, "");

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

/* ── Frequency-aware dismiss check ── */
const FREQ_STORAGE_KEY = "nihongo-ann-freq";

function getFreqData(): Record<string, { ts: number }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(FREQ_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setFreqSeen(id: string) {
  try {
    const d = getFreqData();
    d[id] = { ts: Date.now() };
    localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

function shouldShowByFrequency(ann: Announcement): boolean {
  const freq = ann.showFrequency ?? "once_ever";
  if (freq === "every_visit") return true;
  const data = getFreqData();
  const seen = data[ann.id];
  if (!seen) return true;
  if (freq === "once_ever") return false;
  if (freq === "once_per_day") {
    const oneDayMs = 24 * 60 * 60 * 1000;
    return Date.now() - seen.ts > oneDayMs;
  }
  return true;
}

/* ── Resolve i18n text ── */
function resolveText(ann: Announcement, field: "title" | "body", locale: Locale): string | null {
  if (field === "title") {
    const title = locale === "ja" ? ann.titleJa : locale === "en" ? ann.titleEn : ann.titleVi;
    return title?.trim() || null;
  }
  const body = locale === "ja" ? ann.bodyJa : locale === "en" ? ann.bodyEn : ann.bodyVi;
  return body?.trim() || null;
}

/* ── Background preset classes ── */
const BG_CLASSES: Record<BgPreset, string> = {
  default: "bg-surface",
  "gradient-blue": "bg-gradient-to-br from-[#1B2A4A] via-blue-900 to-slate-900",
  "gradient-violet": "bg-gradient-to-br from-[#1B2A4A] via-[#243560] to-slate-900",
  "gradient-warm": "bg-gradient-to-br from-amber-700 via-amber-800 to-slate-900",
  "gradient-dark": "bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-800",
  "image-only": "bg-black"
};

const isDarkBg = (bg: BgPreset) =>
  ["gradient-blue", "gradient-violet", "gradient-warm", "gradient-dark", "image-only"].includes(bg);

/* ── Modal Component — Non-blocking floating card ── */
function AnnouncementModal({ ann, locale, onDismiss }: { ann: Announcement; locale: Locale; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [canClose, setCanClose] = useState((ann.dismissDelay ?? 0) === 0);
  const [countdown, setCountdown] = useState(ann.dismissDelay ?? 0);
  const title = resolveText(ann, "title", locale);
  const body = resolveText(ann, "body", locale);
  const copy = COPY[locale];
  const bgPreset = (ann.bgPreset ?? "default") as BgPreset;
  const dark = isDarkBg(bgPreset);
  const showClose = ann.allowCloseButton !== false;
  const clickOutside = ann.allowClickOutside !== false;

  // Entrance animation
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Countdown timer for dismissDelay
  useEffect(() => {
    const delay = ann.dismissDelay ?? 0;
    if (delay <= 0) {
      setCanClose(true);
      return;
    }
    setCountdown(delay);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [ann.dismissDelay]);

  const handleDismiss = useCallback(() => {
    if (!canClose) return;
    setVisible(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss, canClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && clickOutside && canClose) handleDismiss();
    },
    [clickOutside, canClose, handleDismiss]
  );

  // CTA theme
  const ctaClass = dark
    ? "bg-white text-gray-900 hover:bg-white/90"
    : "bg-[#1B2A4A] text-white hover:bg-[#243560]";
  const dismissBtnClass = dark
    ? "border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
    : "border-ink/10 text-muted hover:bg-surface hover:text-ink";
  const closeBtnClass = dark
    ? "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
    : "bg-black/5 text-ink/40 hover:bg-black/10 hover:text-ink";

  const modalContent = (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-end p-3 sm:bottom-6 sm:p-5"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="false"
      aria-label={title ?? ann.message}
    >
      <div
        className={`pointer-events-auto relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-white/10 shadow-lg transition-all duration-300 ease-out ${BG_CLASSES[bgPreset]} ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {/* Close button */}
        {showClose && (
          <button
            aria-label={copy.close}
            className={`absolute right-2.5 top-2.5 z-10 flex size-9 items-center justify-center rounded-full transition-colors ${closeBtnClass} ${
              canClose ? "opacity-100" : "opacity-40 cursor-not-allowed"
            }`}
            onClick={canClose ? handleDismiss : undefined}
            disabled={!canClose}
            type="button"
          >
            {canClose ? (
              <IconClose aria-hidden size={16} />
            ) : (
              <span className="text-xs font-bold tabular-nums">{countdown}</span>
            )}
          </button>
        )}

        {/* Content area — compact non-blocking card */}
        <div className="relative flex flex-col items-start px-5 py-4 pr-12 text-left">
          {/* Type badge */}
          <div className="mb-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                dark
                  ? "bg-white/15 text-white/90"
                  : "bg-accent/10 text-accent"
              }`}
            >
              {ann.type === "promo" ? copy.promo : ann.type === "event" ? copy.event : copy.info}
            </span>
          </div>

          {/* Title */}
          <h2
            className={`text-base font-bold leading-snug ${dark ? "text-white" : "text-ink"}`}
          >
            {title ?? (locale === "vi" ? ann.message : "")}
          </h2>

          {/* Body */}
          {body && (
            <p
              className={`mt-1 text-xs leading-relaxed ${dark ? "text-white/75" : "text-muted"}`}
            >
              {body}
            </p>
          )}

          {/* CTA + dismiss */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ann.ctaUrl && (
              <a
                className={`inline-flex min-h-9 items-center justify-center rounded-xl px-4 text-xs font-semibold transition-colors ${ctaClass}`}
                href={ann.ctaUrl}
                rel="noopener noreferrer"
                target={ann.ctaUrl.startsWith("http") ? "_blank" : undefined}
              >
                {ann.ctaLabel ?? copy.more}
              </a>
            )}
            {canClose && (
              <button
                className={`inline-flex min-h-9 items-center justify-center rounded-xl border px-3.5 text-xs font-semibold transition-colors ${dismissBtnClass}`}
                onClick={handleDismiss}
                type="button"
              >
                {copy.later}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}

/* ── Banner Strip Component ── */
export function AnnouncementStrip() {
  const pathname = usePathname() ?? "";
  const locale = (pathname.split("/")[1] as Locale) || "vi";
  const copy = COPY[locale] ?? COPY.vi;
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [modalAnn, setModalAnn] = useState<Announcement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modalShownPathRef = useRef<string | null>(null);
  const homePath = /^\/(vi|en|ja)\/?$/u.test(pathname);

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
      } catch {
        /* network error */
      }
      if (!cancelled) setAnnouncements([]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => announcements.filter((a) => !dismissed.has(a.id) && (locale === "vi" || Boolean(resolveText(a, "title", locale)))),
    [dismissed, announcements, locale]
  );

  const banners = useMemo(() => visible.filter((a) => a.format !== "modal"), [visible]);

  // Promotional modals belong on the home route and never queue one after another.
  useEffect(() => {
    if (!homePath) {
      setModalAnn(null);
      return;
    }
    if (modalShownPathRef.current === pathname) return;
    const first = visible.find((a) => a.format === "modal" && shouldShowByFrequency(a));
    if (first) {
      modalShownPathRef.current = pathname;
      setModalAnn(first);
    }
  }, [homePath, pathname, visible]);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1 || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % banners.length);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length, paused]);

  const dismiss = useCallback(
    (id: string) => {
      const next = new Set(dismissed);
      next.add(id);
      setDismissed(next);
      persistDismissed(next);
      setActiveIdx(0);

      // Also notify server (fire-and-forget)
      fetch(`${API_BASE}/api/announcements/${id}/dismiss`, { method: "POST" }).catch(() => {});
    },
    [dismissed]
  );

  const dismissModal = useCallback(() => {
    if (modalAnn) {
      setFreqSeen(modalAnn.id);
      dismiss(modalAnn.id);
      setModalAnn(null);
    }
  }, [modalAnn, dismiss]);

  const current = banners[activeIdx % Math.max(banners.length, 1)];

  return (
    <>
      {/* Modal overlay */}
      {homePath && modalAnn && <AnnouncementModal ann={modalAnn} locale={locale} onDismiss={dismissModal} />}

      {/* Banner strip */}
      {current && (
        <div
          className="flex items-center justify-center gap-2 border-b border-accent/10 bg-accent/5 px-4 py-2 text-xs text-ink/80"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          role="status"
          aria-live="polite"
        >
          <span
            className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full ${NOTICE_TONE[current.type]}`}
          >
            <IconNotice aria-hidden size={16} />
          </span>

          {(() => {
            const link = current.ctaUrl ?? current.href;
            const Content = link ? "a" : "span";
            const contentProps = link ? { href: link } : {};
            return (
              <Content
                className={link ? "underline-offset-2 hover:underline" : undefined}
                {...contentProps}
              >
                {resolveText(current, "title", locale) ?? current.message}
              </Content>
            );
          })()}

          {/* Dismiss button */}
          <button
            aria-label={copy.close}
            className="ml-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted/70 transition-colors hover:bg-ink/5 hover:text-ink"
            onClick={() => dismiss(current.id)}
            type="button"
          >
            <IconClose aria-hidden size={16} />
          </button>

          {/* Page dots (when >1) */}
          {banners.length > 1 && (
            <span className="ml-1 flex gap-1">
              {banners.map((_, i) => (
                <span
                  className={`inline-block h-1 w-1 rounded-full transition-colors ${
                    i === activeIdx % banners.length ? "bg-accent" : "bg-ink/15"
                  }`}
                  key={i}
                />
              ))}
            </span>
          )}
        </div>
      )}
    </>
  );
}
