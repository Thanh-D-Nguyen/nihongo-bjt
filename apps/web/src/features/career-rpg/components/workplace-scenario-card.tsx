"use client";

import { Card } from "@nihongo-bjt/ui";

import { findNpc } from "../mock-data";
import type { CareerRpgLabels } from "../i18n";
import type { WorkplaceScenario } from "../types";

import { NpcAvatar } from "./npc-relation-card";

interface Props {
  scenario: WorkplaceScenario;
  labels: CareerRpgLabels["chapter"];
}

export function WorkplaceScenarioCard({ scenario, labels }: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#6B7280]">
            {labels.scenarioEyebrow}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-[#111827]">{scenario.titleJa}</h3>
          <p className="text-xs text-[#4B5563]">{scenario.titleVi}</p>
        </div>
        <ScenarioTypeBadge type={scenario.scenarioType} />
      </div>
      <div className="space-y-4 p-5">
        <ScenarioBody scenario={scenario} />
        <div className="rounded-xl border border-dashed border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-xs text-[#78350F]">
          <span className="font-semibold uppercase tracking-[0.16em]">
            {labels.scenarioGoal}
          </span>
          <p className="mt-1 text-sm leading-relaxed text-[#92400E]">{scenario.goalJa}</p>
          <p className="text-xs text-[#B45309]">{scenario.goalVi}</p>
        </div>
        <p className="text-xs text-[#4B5563]">{scenario.contextSummaryVi}</p>
      </div>
    </Card>
  );
}

function ScenarioBody({ scenario }: { scenario: WorkplaceScenario }) {
  if (scenario.scenarioType === "email" && scenario.payload.emailThread) {
    return (
      <ul className="space-y-3">
        {scenario.payload.emailThread.map((mail, idx) => (
          <li className="rounded-xl border border-[#E2E8F0] bg-white" key={idx}>
            <header className="border-b border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2 text-[11px]">
              <p>
                <span className="text-[#6B7280]">From:</span>{" "}
                <span className="font-medium text-[#111827]">{mail.from}</span>
              </p>
              <p>
                <span className="text-[#6B7280]">To:</span>{" "}
                <span className="font-medium text-[#111827]">{mail.to}</span>
              </p>
              <p className="mt-1 font-semibold text-[#1B2A4A]">{mail.subjectJa}</p>
            </header>
            <pre className="whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed text-[#111827]">
              {mail.bodyJa}
            </pre>
          </li>
        ))}
      </ul>
    );
  }
  if (scenario.scenarioType === "meeting" && scenario.payload.meetingTranscript) {
    return (
      <ol className="space-y-2 text-sm">
        {scenario.payload.meetingTranscript.map((line, idx) => (
          <li className="flex gap-3 rounded-md bg-[#F8FAFC] px-3 py-2" key={idx}>
            <span className="text-[11px] font-semibold text-[#6B7280]">{line.speaker}</span>
            <span className="text-[#111827]">{line.lineJa}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (scenario.scenarioType === "chat" && scenario.payload.chatLog) {
    return (
      <ol className="space-y-2 text-sm">
        {scenario.payload.chatLog.map((msg, idx) => {
          const npc = findNpc(msg.speaker);
          return (
            <li className="flex items-start gap-3" key={idx}>
              {npc ? (
                <NpcAvatar
                  avatarInitial={npc.avatarInitial}
                  avatarTint={npc.avatarTint}
                  size={32}
                />
              ) : null}
              <div className="rounded-2xl rounded-tl-sm bg-[#F1F5F9] px-3 py-2 text-[#111827]">
                {msg.lineJa}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }
  return <p className="text-sm text-[#4B5563]">{scenario.contextSummaryVi}</p>;
}

function ScenarioTypeBadge({ type }: { type: WorkplaceScenario["scenarioType"] }) {
  const map: Record<WorkplaceScenario["scenarioType"], { label: string; className: string }> = {
    email: { label: "メール", className: "bg-[#1B2A4A] text-white" },
    meeting: { label: "会議", className: "bg-[#3B82F6] text-white" },
    chat: { label: "チャット", className: "bg-[#059669] text-white" },
    complaint: { label: "クレーム", className: "bg-[#DC2626] text-white" },
    deadline: { label: "期限", className: "bg-[#B45309] text-white" },
    report_chart: { label: "図表", className: "bg-[#7C3AED] text-white" }
  };
  const m = map[type];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${m.className}`}
    >
      {m.label}
    </span>
  );
}
