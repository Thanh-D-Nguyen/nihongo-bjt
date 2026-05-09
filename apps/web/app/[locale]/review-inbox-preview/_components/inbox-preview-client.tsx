"use client";

import Link from "next/link";

import { ReviewInboxPreview } from "../../../../src/features/career-rpg/components/review-inbox-preview";
import { useCareerRpg } from "../../../../src/features/career-rpg/store";
import type { CareerRpgLabels } from "../../../../src/features/career-rpg/i18n";

interface Props {
  labels: CareerRpgLabels;
  locale: string;
}

export function InboxPreviewClient({ labels, locale }: Props) {
  const { inbox } = useCareerRpg();
  const unread = inbox.filter((m) => m.status === "unread").length;

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

      <ReviewInboxPreview inbox={inbox} labels={labels.inbox} />
    </div>
  );
}
