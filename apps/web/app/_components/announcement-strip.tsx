"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { createPortal } from "react-dom";

import { IconClose, IconNotice } from "./app-icons";

/* ── Types ── */
type AnnouncementType = "info" | "event" | "promo";
type AnnouncementFormat = "banner" | "modal";
type EffectPreset = "none" | "confetti" | "particles" | "shimmer" | "aurora" | "sakura";
type BgPreset = "default" | "gradient-blue" | "gradient-violet" | "gradient-warm" | "gradient-dark" | "image-only";
type ShowFrequency = "every_visit" | "once_per_day" | "once_ever";

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
  promo: "bg-violet-100 text-violet-700",
};

/* ── API + LocalStorage dismiss ── */
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

/* ── Frequency-aware dismiss check ── */
const FREQ_STORAGE_KEY = "nihongo-ann-freq";

function getFreqData(): Record<string, { ts: number }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(FREQ_STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function setFreqSeen(id: string) {
  try {
    const d = getFreqData();
    d[id] = { ts: Date.now() };
    localStorage.setItem(FREQ_STORAGE_KEY, JSON.stringify(d));
  } catch { /* ignore */ }
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
function resolveText(
  ann: Announcement,
  field: "title" | "body",
): string | null {
  const locale =
    typeof document !== "undefined"
      ? document.documentElement.lang || "vi"
      : "vi";
  if (field === "title") {
    if (locale === "ja" && ann.titleJa) return ann.titleJa;
    if (locale === "en" && ann.titleEn) return ann.titleEn;
    return ann.titleVi ?? null;
  }
  if (locale === "ja" && ann.bodyJa) return ann.bodyJa;
  if (locale === "en" && ann.bodyEn) return ann.bodyEn;
  return ann.bodyVi ?? null;
}

/* ── Background preset classes ── */
const BG_CLASSES: Record<BgPreset, string> = {
  "default": "bg-white",
  "gradient-blue": "bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500",
  "gradient-violet": "bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500",
  "gradient-warm": "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500",
  "gradient-dark": "bg-gradient-to-br from-gray-900 via-slate-900 to-zinc-800",
  "image-only": "bg-black",
};

const isDarkBg = (bg: BgPreset) => ["gradient-blue", "gradient-violet", "gradient-warm", "gradient-dark", "image-only"].includes(bg);

/* ── Effect renderers ── */
function EffectLayer({ effect, bg }: { effect: EffectPreset; bg: BgPreset }) {
  if (effect === "none") return null;
  const dark = isDarkBg(bg);

  if (effect === "confetti") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {[...Array(24)].map((_, i) => (
          <span
            key={i}
            className="absolute ann-confetti-piece"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2.5 + Math.random() * 2}s`,
              color: ["#F59E0B", "#3B82F6", "#EC4899", "#10B981", "#8B5CF6", "#F97316"][i % 6],
              fontSize: `${10 + Math.random() * 8}px`,
            }}
          >
            {["●", "■", "▲", "★", "♦", "✦"][i % 6]}
          </span>
        ))}
      </div>
    );
  }

  if (effect === "particles") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {[...Array(16)].map((_, i) => (
          <span
            key={i}
            className={`absolute ann-particle rounded-full ${dark ? "bg-white/20" : "bg-ink/10"}`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${4 + Math.random() * 8}px`,
              height: `${4 + Math.random() * 8}px`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${4 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (effect === "shimmer") {
    return <div className="pointer-events-none absolute inset-0 ann-shimmer-sweep" aria-hidden />;
  }

  if (effect === "aurora") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -inset-[50%] ann-aurora opacity-30" />
      </div>
    );
  }

  if (effect === "sakura") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {[...Array(12)].map((_, i) => (
          <span
            key={i}
            className="absolute ann-sakura-petal"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 3}s`,
              fontSize: `${14 + Math.random() * 10}px`,
              opacity: 0.6 + Math.random() * 0.4,
            }}
          >
            🌸
          </span>
        ))}
      </div>
    );
  }

  return null;
}

/* ── Modal Component — Full-viewport world-class design ── */
function AnnouncementModal({
  ann,
  onDismiss,
}: {
  ann: Announcement;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [canClose, setCanClose] = useState((ann.dismissDelay ?? 0) === 0);
  const [countdown, setCountdown] = useState(ann.dismissDelay ?? 0);
  const title = resolveText(ann, "title");
  const body = resolveText(ann, "body");
  const bgPreset = (ann.bgPreset ?? "default") as BgPreset;
  const effect = (ann.effect ?? "none") as EffectPreset;
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
    if (delay <= 0) { setCanClose(true); return; }
    setCountdown(delay);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); setCanClose(true); return 0; }
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

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && clickOutside && canClose) handleDismiss();
  }, [clickOutside, canClose, handleDismiss]);

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
      className={`fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 transition-all duration-400 ${
        visible ? "bg-black/60 backdrop-blur-xl" : "bg-black/0 backdrop-blur-none"
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? ann.message}
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-3xl shadow-2xl transition-all duration-600 ease-out ${BG_CLASSES[bgPreset]} ${
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-12 scale-90 opacity-0"
        }`}
        style={{
          maxWidth: "min(560px, 95vw)",
          maxHeight: "90vh",
          boxShadow: visible ? "0 40px 80px -16px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1)" : undefined,
        }}
      >
        {/* Effects layer */}
        <EffectLayer effect={effect} bg={bgPreset} />

        {/* Hero image */}
        {ann.imageUrl && (
          <div className="relative w-full shrink-0 overflow-hidden" style={{ maxHeight: "45vh" }}>
            <img
              src={ann.imageUrl}
              alt=""
              className={`w-full object-cover transition-transform duration-700 ${visible ? "scale-100" : "scale-110"}`}
              style={{ maxHeight: "45vh" }}
            />
            {bgPreset !== "image-only" && (
              <div className={`absolute inset-0 bg-gradient-to-t ${dark ? "from-black/80 via-transparent" : "from-white via-transparent"}`} />
            )}
          </div>
        )}

        {/* Close button */}
        {showClose && (
          <button
            aria-label="Close"
            className={`absolute right-3 top-3 z-10 flex items-center justify-center rounded-full backdrop-blur-sm transition-all ${closeBtnClass} ${
              canClose ? "opacity-100 hover:scale-110" : "opacity-40 cursor-not-allowed"
            }`}
            onClick={canClose ? handleDismiss : undefined}
            disabled={!canClose}
            type="button"
            style={{ width: 40, height: 40 }}
          >
            {canClose ? (
              <IconClose aria-hidden size={18} />
            ) : (
              <span className="text-xs font-bold tabular-nums">{countdown}</span>
            )}
          </button>
        )}

        {/* Content area — scrollable */}
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 sm:px-10 sm:py-10 text-center">
          {/* Type badge */}
          <div className="mb-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
              dark ? "bg-white/15 text-white/90" :
              ann.type === "promo" ? "bg-violet-100 text-violet-700" :
              ann.type === "event" ? "bg-amber-100 text-amber-700" :
              "bg-blue-100 text-blue-700"
            }`}>
              {ann.type === "promo" ? "🎁 Khuyến mãi" : ann.type === "event" ? "📅 Sự kiện" : "ℹ️ Thông báo"}
            </span>
          </div>

          {/* Title */}
          <h2 className={`mb-3 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl ${dark ? "text-white" : "text-ink"}`}>
            {title || ann.message}
          </h2>

          {/* Body */}
          {body && (
            <p className={`mb-6 max-w-md text-base leading-relaxed sm:text-lg ${dark ? "text-white/75" : "text-ink/65"}`}>
              {body}
            </p>
          )}

          {/* CTA + dismiss */}
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {ann.ctaUrl && (
              <a
                className={`inline-flex min-h-14 items-center justify-center rounded-2xl px-8 text-base font-bold shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:shadow-md sm:min-h-12 sm:text-sm ${ctaClass}`}
                href={ann.ctaUrl}
                rel="noopener noreferrer"
                target={ann.ctaUrl.startsWith("http") ? "_blank" : undefined}
              >
                {ann.ctaLabel ?? "Xem thêm →"}
              </a>
            )}
            {canClose && (
              <button
                className={`inline-flex min-h-14 items-center justify-center rounded-2xl border-2 px-6 text-base font-semibold transition-all duration-200 sm:min-h-12 sm:text-sm ${dismissBtnClass}`}
                onClick={handleDismiss}
                type="button"
              >
                Để sau
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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [modalAnn, setModalAnn] = useState<Announcement | null>(null);
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

  const banners = useMemo(
    () => visible.filter((a) => a.format !== "modal"),
    [visible],
  );

  const modals = useMemo(
    () => visible.filter((a) => a.format === "modal" && shouldShowByFrequency(a)),
    [visible],
  );

  // Show first undismissed modal on mount
  useEffect(() => {
    if (modals.length > 0 && !modalAnn) {
      setModalAnn(modals[0]);
    }
  }, [modals, modalAnn]);

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
    [dismissed],
  );

  const dismissModal = useCallback(() => {
    if (modalAnn) {
      setFreqSeen(modalAnn.id);
      dismiss(modalAnn.id);
      const remaining = modals.filter((m) => m.id !== modalAnn.id && !dismissed.has(m.id));
      setModalAnn(remaining.length > 0 ? remaining[0] : null);
    }
  }, [modalAnn, modals, dismissed, dismiss]);

  const current = banners[activeIdx % Math.max(banners.length, 1)];

  return (
    <>
      {/* Modal overlay */}
      {modalAnn && <AnnouncementModal ann={modalAnn} onDismiss={dismissModal} />}

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
          <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full ${NOTICE_TONE[current.type]}`}>
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
                {current.message}
              </Content>
            );
          })()}

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
