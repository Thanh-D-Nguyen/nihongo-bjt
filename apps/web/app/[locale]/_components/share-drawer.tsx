"use client";

import { Sheet } from "@nihongo-bjt/ui";
import { useState, useEffect, useCallback, useRef } from "react";
import { learnerApiFetch } from "@/lib/learner-api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TemplateItem {
  id: string;
  slug: string;
  kind: string;
  config: Record<string, unknown>;
}

export interface ShareDrawerProps {
  open: boolean;
  onClose: () => void;
  kind: "streak" | "bjt_result" | "daily_phrase" | "battle";
  payload: Record<string, unknown>;
  userId: string;
  hasOptedIn: boolean;
  labels: {
    title: string;
    selectTemplate: string;
    preview: string;
    share: string;
    copyLink: string;
    download: string;
    cancel: string;
    consentTitle: string;
    consentMessage: string;
    consentAccept: string;
    consentDecline: string;
    loading: string;
    noTemplates: string;
    shareSuccess: string;
    copied: string;
    error: string;
    retry?: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function headlineAndSub(
  kind: ShareDrawerProps["kind"],
  payload: Record<string, unknown>,
): { headline: string; sub: string } {
  switch (kind) {
    case "streak":
      return { headline: `🔥 ${payload.streakDays}日連続`, sub: "Learning streak" };
    case "bjt_result":
      return { headline: `BJT ${payload.band}`, sub: "Practice result" };
    case "daily_phrase":
      return { headline: String(payload.phraseLabel ?? ""), sub: "Japanese in daily life" };
    case "battle":
      return { headline: String(payload.outcome ?? ""), sub: "Battle result" };
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ShareDrawer({
  open,
  onClose,
  kind,
  payload,
  userId,
  hasOptedIn,
  labels,
}: ShareDrawerProps) {
  /* ---- state ---- */
  const [consented, setConsented] = useState(hasOptedIn);
  const [consentLoading, setConsentLoading] = useState(false);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const prevBlobRef = useRef<string | null>(null);

  /* ---- sync hasOptedIn prop ---- */
  useEffect(() => {
    setConsented(hasOptedIn);
  }, [hasOptedIn]);

  /* ---- revoke previous preview blob when a new one loads ---- */
  useEffect(() => {
    return () => {
      if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
    };
  }, []);

  /* ---- fetch templates on open ---- */
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(false);
    try {
      const res = await learnerApiFetch(`/api/learner/share/templates?kind=${kind}`);
      if (!res.ok) throw new Error("fetch_templates");
      const data: TemplateItem[] = await res.json();
      setTemplates(data);
      if (data.length > 0) setSelectedId(data[0].id);
    } catch {
      setTemplatesError(true);
    } finally {
      setTemplatesLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    if (open && consented) {
      fetchTemplates();
    }
    if (!open) {
      // reset on close
      setSelectedId(null);
      setPreviewUrl(null);
      setPreviewError(false);
      setInlineError(null);
      setCopied(false);
      setTemplates([]);
    }
  }, [open, consented, fetchTemplates]);

  /* ---- fetch preview when template selected ---- */
  const fetchPreview = useCallback(async () => {
    if (!selectedId) return;
    setPreviewLoading(true);
    setPreviewError(false);
    try {
      const { headline, sub } = headlineAndSub(kind, payload);
      const params = new URLSearchParams({
        templateId: selectedId,
        kind,
        headline,
        sub,
      });
      const res = await learnerApiFetch(`/api/learner/share/preview?${params.toString()}`);
      if (!res.ok) throw new Error("fetch_preview");
      const blob = await res.blob();
      if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
      const url = URL.createObjectURL(blob);
      prevBlobRef.current = url;
      setPreviewUrl(url);
    } catch {
      setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [selectedId, kind, payload]);

  useEffect(() => {
    if (selectedId) fetchPreview();
  }, [selectedId, fetchPreview]);

  /* ---- consent accept ---- */
  const handleConsentAccept = async () => {
    setConsentLoading(true);
    try {
      const res = await learnerApiFetch("/api/learner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharePostcardOptIn: true }),
      });
      if (!res.ok) throw new Error("consent_patch");
      setConsented(true);
    } catch {
      setInlineError(labels.error);
    } finally {
      setConsentLoading(false);
    }
  };

  /* ---- create share + return URL ---- */
  const createShare = async (): Promise<string | null> => {
    try {
      const res = await learnerApiFetch("/api/learner/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, userId, payload }),
      });
      if (!res.ok) throw new Error("create_share");
      const data = await res.json();
      return data.shareUrl as string;
    } catch {
      setInlineError(labels.error);
      return null;
    }
  };

  /* ---- share action ---- */
  const handleShare = async () => {
    setShareLoading(true);
    setInlineError(null);
    const url = await createShare();
    if (!url) {
      setShareLoading(false);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "NihonGo BJT", url });
      } catch {
        /* user cancelled share — not an error */
      }
    } else {
      // fallback: copy
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setShareLoading(false);
  };

  /* ---- copy link ---- */
  const handleCopy = async () => {
    setShareLoading(true);
    setInlineError(null);
    const url = await createShare();
    if (!url) {
      setShareLoading(false);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShareLoading(false);
  };

  /* ---- download ---- */
  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `nihongo-bjt-${kind}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <Sheet open={open}>
      {/* backdrop close */}
      {/* biome-ignore lint: click on overlay to close */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />

      <div className="relative z-10 px-5 pb-8 pt-4">
        {/* drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300" />

        {/* title */}
        <h2 className="mb-4 text-lg font-semibold text-[hsl(var(--ink))]">{labels.title}</h2>

        {/* ---- CONSENT STEP ---- */}
        {!consented && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-[hsl(var(--ink))]">
              {labels.consentTitle}
            </h3>
            <p className="text-sm leading-relaxed text-[hsl(var(--muted))]">
              {labels.consentMessage}
            </p>
            {inlineError && (
              <p className="text-sm text-red-600">{inlineError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={consentLoading}
                onClick={handleConsentAccept}
                className="flex-1 rounded-xl bg-[hsl(var(--accent))] min-h-[48px] px-4 font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-60"
              >
                {consentLoading ? labels.loading : labels.consentAccept}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-[hsl(var(--border))] min-h-[48px] px-4 font-semibold text-[hsl(var(--ink))] transition-transform active:scale-[0.97]"
              >
                {labels.consentDecline}
              </button>
            </div>
          </div>
        )}

        {/* ---- TEMPLATE + PREVIEW + ACTIONS ---- */}
        {consented && (
          <div className="space-y-5">
            {/* template picker */}
            <div>
              <p className="mb-2 text-sm font-medium text-[hsl(var(--muted))]">
                {labels.selectTemplate}
              </p>

              {templatesLoading && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-[63px] w-[120px] flex-shrink-0 animate-pulse rounded-lg bg-slate-200"
                    />
                  ))}
                </div>
              )}

              {templatesError && (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-red-600">{labels.error}</p>
                  <button
                    type="button"
                    onClick={fetchTemplates}
                    className="text-sm font-medium text-[hsl(var(--accent))] underline active:scale-[0.97] transition-transform"
                  >
                    {labels.retry || "Retry"}
                  </button>
                </div>
              )}

              {!templatesLoading && !templatesError && templates.length === 0 && (
                <div className="space-y-3 py-6 text-center">
                  <svg className="mx-auto h-10 w-10 text-[hsl(var(--muted)/0.5)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  <p className="text-sm text-[hsl(var(--muted))]">{labels.noTemplates}</p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-sm font-medium text-[hsl(var(--accent))] active:scale-[0.97] transition-transform"
                  >
                    {labels.cancel}
                  </button>
                </div>
              )}

              {!templatesLoading && !templatesError && templates.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={`relative flex h-[63px] w-[120px] flex-shrink-0 items-center justify-center rounded-lg border-2 transition-all cursor-pointer text-xs font-medium text-[hsl(var(--ink))] active:scale-[0.97] overflow-hidden ${
                        selectedId === t.id
                          ? "border-[hsl(var(--accent))] ring-2 ring-[hsl(var(--accent)/0.3)]"
                          : "border-transparent hover:border-[hsl(var(--accent))]"
                      } bg-[hsl(var(--surface))]`}
                    >
                      {t.slug}
                      {((t.config.brandAccent as string) || (t.config.brandBg as string)) && (
                        <span
                          className="pointer-events-none absolute inset-x-0 bottom-0 h-1"
                          style={{ backgroundColor: (t.config.brandAccent as string) || (t.config.brandBg as string) }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* preview */}
            {selectedId && (
              <div>
                <p className="mb-2 text-sm font-medium text-[hsl(var(--muted))]">
                  {labels.preview}
                </p>

                {previewLoading && (
                  <div className="aspect-[1200/630] w-full animate-pulse rounded-lg bg-slate-200" />
                )}

                {previewError && !previewLoading && (
                  <div className="flex aspect-[1200/630] w-full items-center justify-center rounded-lg bg-slate-100">
                    <button
                      type="button"
                      onClick={fetchPreview}
                      className="text-sm font-medium text-[hsl(var(--accent))] underline active:scale-[0.97] transition-transform"
                    >
                      {labels.retry || "Retry"}
                    </button>
                  </div>
                )}

                {previewUrl && !previewLoading && !previewError && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={previewUrl}
                    alt={labels.preview}
                    className="aspect-[1200/630] w-full rounded-lg object-cover shadow-md border border-[hsl(var(--border)/0.5)]"
                  />
                )}
              </div>
            )}

            {/* inline error */}
            {inlineError && (
              <p className="text-sm text-red-600">{inlineError}</p>
            )}

            {/* copied feedback */}
            {copied && (
              <p className="text-center text-sm font-medium text-emerald-600">{labels.copied}</p>
            )}

            {/* action buttons */}
            {selectedId && previewUrl && !previewLoading && (
              <div className="space-y-3 md:flex md:gap-3 md:space-y-0">
                <button
                  type="button"
                  disabled={shareLoading}
                  onClick={handleShare}
                  className="w-full rounded-xl bg-[hsl(var(--accent))] min-h-[48px] px-4 font-semibold text-white transition-transform active:scale-[0.97] disabled:opacity-60 md:flex-1"
                >
                  {shareLoading ? labels.loading : labels.share}
                </button>
                <button
                  type="button"
                  disabled={shareLoading}
                  onClick={handleCopy}
                  className="w-full rounded-xl border border-[hsl(var(--border))] min-h-[48px] px-4 font-semibold text-[hsl(var(--ink))] transition-transform active:scale-[0.97] disabled:opacity-60 md:flex-1"
                >
                  {labels.copyLink}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full rounded-xl border border-[hsl(var(--border))] min-h-[48px] px-4 font-semibold text-[hsl(var(--ink))] transition-transform active:scale-[0.97] md:flex-1"
                >
                  {labels.download}
                </button>
              </div>
            )}

            {/* cancel */}
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[48px] text-sm font-medium text-[hsl(var(--muted))] transition-all hover:text-[hsl(var(--ink))] active:scale-[0.97]"
            >
              {labels.cancel}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
