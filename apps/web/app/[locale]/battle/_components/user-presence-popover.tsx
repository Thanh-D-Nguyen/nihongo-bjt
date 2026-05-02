"use client";

import { useEffect, useRef, useState } from "react";

type UserPresencePopoverProps = {
  displayName: string;
  isSelf: boolean;
  labels: {
    challenge: string;
    lobbyOnline: string;
    member: string;
    userLabel: string;
  };
  onChallenge: () => void;
  onClose: () => void;
  onHoverGroupEnter?: () => void;
  onHoverGroupLeave?: () => void;
  triggerRect: DOMRect;
};

export function UserPresencePopover({
  displayName,
  isSelf,
  labels,
  onChallenge,
  onClose,
  onHoverGroupEnter,
  onHoverGroupLeave,
  triggerRect
}: UserPresencePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const popoverWidth = 260;
    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = triggerRect.top + triggerRect.height / 2 - 72;
    let left = triggerRect.left - popoverWidth - gap;

    if (left < 8) {
      left = triggerRect.right + gap;
    }

    if (left + popoverWidth > vw - 8) {
      left = Math.max(8, triggerRect.left + triggerRect.width / 2 - popoverWidth / 2);
      top = triggerRect.bottom + gap;
    }

    top = Math.max(8, Math.min(top, vh - 200));
    left = Math.max(8, Math.min(left, vw - popoverWidth - 8));

    setPosition({ left, top });
    requestAnimationFrame(() => setVisible(true));
  }, [triggerRect]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      className={`fixed z-50 w-[260px] rounded-2xl border border-leaf/25 bg-surface p-4 shadow-xl transition-all duration-150 ${
        visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
      }`}
      onMouseEnter={onHoverGroupEnter}
      onMouseLeave={onHoverGroupLeave}
      ref={ref}
      role="dialog"
      aria-label={displayName}
      style={{ left: position.left, top: position.top }}
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-leaf">{labels.member}</p>
      <p className="mt-1 truncate text-sm font-bold text-ink">{displayName}</p>
      <p className="mt-1 text-xs font-semibold text-muted">
        {isSelf ? labels.userLabel : labels.lobbyOnline}
      </p>
      {!isSelf ? (
        <button
          className="mt-3 w-full rounded-xl bg-ink py-2 text-sm font-bold text-surface hover:bg-ink/90"
          onClick={() => {
            onChallenge();
            onClose();
          }}
          type="button"
        >
          {labels.challenge}
        </button>
      ) : null}
    </div>
  );
}
