"use client";

/** Labels for the collapsible BJT format reference panel (all i18n). */
export type BjtFormatGuideLabels = {
  bullet1: string;
  bullet2: string;
  bullet3: string;
  bullet4: string;
  bullet5: string;
  disclaimer: string;
  helpLink: string;
  intro: string;
  officialPartListening: string;
  officialPartListeningReading: string;
  officialPartReading: string;
  officialSection1: string;
  officialSection2: string;
  officialSection3: string;
  officialStatQuestions: string;
  officialStatRanks: string;
  officialStatScore: string;
  officialStatTime: string;
  officialStrategy1: string;
  officialStrategy2: string;
  officialStrategy3: string;
  officialStrategyTitle: string;
  summary: string;
};

export function BjtFormatGuidePanel({ labels }: { labels: BjtFormatGuideLabels; locale: string }) {
  const stats = [
    labels.officialStatQuestions,
    labels.officialStatTime,
    labels.officialStatScore,
    labels.officialStatRanks
  ];
  const parts = [
    {
      items: labels.officialSection1,
      title: labels.officialPartListening
    },
    {
      items: labels.officialSection2,
      title: labels.officialPartListeningReading
    },
    {
      items: labels.officialSection3,
      title: labels.officialPartReading
    }
  ];
  const strategies = [labels.officialStrategy1, labels.officialStrategy2, labels.officialStrategy3];

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-ink/10 bg-surface shadow-sm">
      <div className="grid gap-4 border-b border-ink/10 bg-ink p-4 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
        <div>
          <h2 className="text-lg font-black">{labels.summary}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/68">
            {labels.intro}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-[20rem]">
          {stats.map((item) => {
            const [value, label] = item.split("|");
            return (
              <div className="rounded-2xl border border-white/10 bg-white/8 p-3" key={item}>
                <p className="text-lg font-black leading-none">{value}</p>
                <p className="mt-1 text-[11px] font-bold text-white/60">{label}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_1fr]">
        {parts.map((part, index) => (
          <article className="rounded-2xl border border-ink/10 bg-paper/60 p-4" key={part.title}>
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-sm font-black text-accent">
              {index + 1}
            </div>
            <h3 className="text-sm font-black text-ink">{part.title}</h3>
            <p className="mt-2 text-xs font-semibold leading-5 text-muted">{part.items}</p>
          </article>
        ))}
      </div>
      <div className="border-t border-ink/10 bg-paper/50 p-4">
        <p className="text-xs font-black uppercase text-muted">{labels.officialStrategyTitle}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {strategies.map((item) => (
            <p
              className="rounded-xl border border-ink/10 bg-surface px-3 py-2 text-xs font-semibold leading-5 text-ink"
              key={item}
            >
              {item}
            </p>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">{labels.disclaimer}</p>
      </div>
    </section>
  );
}
