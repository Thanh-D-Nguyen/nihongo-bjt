"use client";

import { useCallback, useEffect, useState } from "react";

import { cn } from "./cn";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastMessage = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  /** Auto-dismiss after ms (default 5000, 0 = manual) */
  duration?: number;
};

/* ------------------------------------------------------------------ */
/*  useAdminToast hook                                                */
/* ------------------------------------------------------------------ */

export function useAdminToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (variant: ToastVariant, title: string, description?: string, duration = 5000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, variant, title, description, duration }]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (title: string, description?: string) => addToast("success", title, description),
    [addToast]
  );

  const error = useCallback(
    (title: string, description?: string) => addToast("error", title, description, 8000),
    [addToast]
  );

  const warning = useCallback(
    (title: string, description?: string) => addToast("warning", title, description, 6000),
    [addToast]
  );

  const info = useCallback(
    (title: string, description?: string) => addToast("info", title, description),
    [addToast]
  );

  return { toasts, addToast, removeToast, success, error, warning, info };
}

/* ------------------------------------------------------------------ */
/*  AdminToastContainer — renders toast stack                         */
/* ------------------------------------------------------------------ */

const variantStyles: Record<ToastVariant, { bg: string; icon: string; border: string }> = {
  success: {
    bg: "bg-emerald-50",
    icon: "text-emerald-500",
    border: "border-emerald-200",
  },
  error: {
    bg: "bg-red-50",
    icon: "text-red-500",
    border: "border-red-200",
  },
  warning: {
    bg: "bg-amber-50",
    icon: "text-amber-500",
    border: "border-amber-200",
  },
  info: {
    bg: "bg-blue-50",
    icon: "text-blue-500",
    border: "border-blue-200",
  },
};

const variantIcons: Record<ToastVariant, string> = {
  success:
    "M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z",
  error:
    "M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z",
  warning:
    "M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z",
  info: "M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z",
};

function ToastItem({
  toast,
  onRemove,
}: {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}) {
  const style = variantStyles[toast.variant];

  useEffect(() => {
    if (toast.duration === 0) return;
    const timer = setTimeout(() => onRemove(toast.id), toast.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 shadow-lg transition-all animate-in slide-in-from-right-5 fade-in duration-300",
        style.bg,
        style.border
      )}
      role="alert"
    >
      <svg className={cn("mt-0.5 h-5 w-5 shrink-0", style.icon)} fill="currentColor" viewBox="0 0 20 20">
        <path clipRule="evenodd" d={variantIcons[toast.variant]} fillRule="evenodd" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-neutral-600">{toast.description}</p>
        )}
      </div>
      <button
        className="shrink-0 rounded p-0.5 text-neutral-400 hover:text-neutral-600 transition-colors"
        onClick={() => onRemove(toast.id)}
        type="button"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            clipRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            fillRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

export function AdminToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} onRemove={onRemove} toast={t} />
      ))}
    </div>
  );
}
