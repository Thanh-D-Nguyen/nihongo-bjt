"use client";

export type LotoTab = "predictions" | "lab";

interface Props {
  tab: LotoTab;
  onChange: (tab: LotoTab) => void;
  labelPredictions: string;
  labelLab: string;
}

const TABS: Array<{ id: LotoTab; icon: string }> = [
  { id: "predictions", icon: "🎯" },
  { id: "lab", icon: "🧪" }
];

export function LotoTabs({ tab, onChange, labelPredictions, labelLab }: Props) {
  const labels: Record<LotoTab, string> = { predictions: labelPredictions, lab: labelLab };
  return (
    <div role="tablist" className="mt-2 flex items-center gap-4 border-b border-border/30">
      {TABS.map(({ id, icon }) => {
        const selected = tab === id;
        return (
          <button
            key={id}
            id={`loto-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`loto-panel-${id}`}
            onClick={() => onChange(id)}
            className={`-mb-px flex min-h-11 items-center gap-1.5 border-b-2 px-1 text-sm font-semibold transition-colors ${
              selected
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <span aria-hidden="true">{icon}</span>
            {labels[id]}
          </button>
        );
      })}
    </div>
  );
}
