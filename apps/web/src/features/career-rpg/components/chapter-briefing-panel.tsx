"use client";

import { Button, Card } from "@nihongo-bjt/ui";

import type { CareerRpgLabels } from "../i18n";
import type { MissionChapter } from "../types";

interface Props {
  chapter: MissionChapter;
  labels: CareerRpgLabels["chapter"];
  onStart: () => void;
}

export function ChapterBriefingPanel({ chapter, labels, onStart }: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1B2A4A] to-[#243560] px-6 py-8 text-white">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">
          {labels.briefingEyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-snug">
          {chapter.isBoss ? "【難関】 " : null}
          {chapter.titleJa}
        </h1>
        <p className="mt-1 text-sm text-white/75">{chapter.titleVi}</p>
      </div>
      <div className="space-y-4 p-6">
        <p className="text-sm leading-relaxed text-[#111827]">{chapter.briefingJa}</p>
        <p className="text-sm leading-relaxed text-[#4B5563]">{chapter.briefingVi}</p>
        <div className="flex flex-wrap gap-3 border-t border-dashed border-[#E2E8F0] pt-4 text-xs text-[#4B5563]">
          <Stat label={labels.yourRoleLabel} value={chapter.yourRoleVi} />
          <Stat label={labels.estimatedLabel} value={`${chapter.estimatedMinutes} 分`} />
        </div>
        <div className="pt-2">
          <Button onClick={onStart} size="lg" variant="primary">
            {labels.startCta}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#6B7280]">{label}</span>
      <span className="text-sm text-[#111827]">{value}</span>
    </div>
  );
}
