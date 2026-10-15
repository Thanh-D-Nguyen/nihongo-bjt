"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ReviewInboxPreview } from "../../../../src/features/career-rpg/components/review-inbox-preview";
import { careerInbox, submitContextMemoFeedback } from "../../../../src/features/career-rpg/api";
import type { CareerRpgLabels } from "../../../../src/features/career-rpg/i18n";
import type { ContextMemo } from "../../../../src/features/career-rpg/types";

interface Props {
  labels: CareerRpgLabels;
  locale: string;
}

export function InboxPreviewClient({ labels, locale }: Props) {
  const router = useRouter();
  const [inbox, setInbox] = useState<ContextMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const unread = inbox.filter((m) => m.status === "unread").length;
  const loginPath = `/${locale}/login?returnTo=${encodeURIComponent(`/${locale}/review-inbox-preview`)}`;

  useEffect(() => {
    let alive = true;
    let redirecting = false;
    setLoading(true);
    void careerInbox()
      .then((items) => {
        if (alive) {
          setInbox(items);
          setLoadError(false);
        }
      })
      .catch((error: unknown) => {
        if (!alive) return;
        if (error instanceof Error && error.message.includes(": 401")) {
          redirecting = true;
          router.replace(loginPath);
          return;
        }
        setLoadError(true);
      })
      .finally(() => {
        if (alive && !redirecting) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [locale, loginPath, retryKey, router]);

  async function handleFeedback(id: string, feedback: "useful" | "fuzzy" | "lost") {
    try {
      await submitContextMemoFeedback(id, feedback);
      setInbox((current) =>
        current.map((memo) => (memo.id === id ? { ...memo, status: "read", feedback } : memo))
      );
      setFeedbackError(false);
    } catch (error) {
      if (error instanceof Error && error.message.includes(": 401")) {
        router.replace(loginPath);
        return;
      }
      setFeedbackError(true);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#6B7280]">
            {labels.inbox.eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight text-[#111827]">
            {labels.inbox.title}
          </h1>
          <p className="text-sm text-[#4B5563]">
            {labels.inbox.subtitle}
            {unread > 0 ? (
              <span className="ml-2 rounded-full bg-[#9F1239] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                {unread} {labels.inbox.statusUnread}
              </span>
            ) : null}
          </p>
        </div>
        <Link
          className="inline-flex min-h-9 items-center justify-center rounded-[10px] border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-[#111827] shadow-sm transition-colors hover:bg-[#F8FAFC]"
          href={`/${locale}/daily-standup`}
        >
          ← {labels.career.backHome}
        </Link>
      </header>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-[#F1F5F9]" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl bg-[#F8FAFC]" />
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-[#FECACA] bg-white p-8 text-center" role="alert">
          <p className="text-sm text-[#9F1239]">{labels.inbox.loadError}</p>
          <button
            className="mt-4 min-h-11 rounded-lg bg-[#1B2A4A] px-4 text-sm font-semibold text-white"
            onClick={() => {
              setLoading(true);
              setRetryKey((key) => key + 1);
            }}
            type="button"
          >
            {labels.inbox.retry}
          </button>
        </div>
      ) : (
        <ReviewInboxPreview
          inbox={inbox}
          labels={labels.inbox}
          feedbackError={feedbackError ? labels.inbox.feedbackError : null}
          onFeedback={handleFeedback}
        />
      )}
    </div>
  );
}
