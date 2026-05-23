"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ReviewInboxPreview } from "../../../../src/features/career-rpg/components/review-inbox-preview";
import { careerInbox } from "../../../../src/features/career-rpg/api";
import type { CareerRpgLabels } from "../../../../src/features/career-rpg/i18n";
import type { ContextMemo } from "../../../../src/features/career-rpg/types";

interface Props {
  labels: CareerRpgLabels;
  locale: string;
}

export function InboxPreviewClient({ labels, locale }: Props) {
  const [inbox, setInbox] = useState<ContextMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const unread = inbox.filter((m) => m.status === "unread").length;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void careerInbox()
      .then((items) => {
        if (alive) setInbox(items);
      })
      .catch(() => {
        if (alive) setInbox([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

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
      ) : (
        <ReviewInboxPreview inbox={inbox} labels={labels.inbox} />
      )}
    </div>
  );
}
