"use client";

import { Button, Dialog, Input } from "@nihongo-bjt/ui";
import { useEffect, useId, useRef, useState } from "react";

export interface NhkCreateDeckDialogLabels {
  cancel: string;
  description: string;
  error?: string;
  nameHint: string;
  nameLabel: string;
  namePlaceholder: string;
  submit: string;
  title: string;
}

export function NhkCreateDeckDialog({
  labels,
  loading,
  onClose,
  onSubmit,
  open
}: {
  labels: NhkCreateDeckDialogLabels;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (deckTitle: string | null) => void;
  open: boolean;
}) {
  const [deckTitle, setDeckTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      setDeckTitle("");
      return;
    }
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [loading, onClose, open]);

  if (!open) return null;

  return (
    <Dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
      open={open}
      role="dialog"
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(deckTitle.trim() || null);
        }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">NHK News</p>
          <h2 className="mt-2 text-lg font-semibold leading-tight text-ink" id={titleId}>
            {labels.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted" id={descriptionId}>
            {labels.description}
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-semibold text-ink">{labels.nameLabel}</span>
          <Input
            className="mt-2"
            disabled={loading}
            onChange={(event) => setDeckTitle(event.target.value)}
            placeholder={labels.namePlaceholder}
            ref={inputRef}
            value={deckTitle}
          />
          <span className="mt-2 block text-xs leading-relaxed text-muted">{labels.nameHint}</span>
        </label>

        {labels.error ? (
          <div className="rounded-xl border border-sakura/20 bg-sakura/8 px-3 py-2 text-sm font-medium text-sakura">
            {labels.error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={loading} onClick={onClose} type="button" variant="secondary">
            {labels.cancel}
          </Button>
          <Button disabled={loading} type="submit">
            {labels.submit}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
