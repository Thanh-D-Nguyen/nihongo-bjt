/** widgetKind → icon mapping for Daily Hub preview cards */

const WIDGET_ICON_MAP: Record<string, { kanji: string; bg: string; fg: string }> = {
  weather: { kanji: "天", bg: "bg-sky-100", fg: "text-sky-600" },
  business_phrase: { kanji: "商", bg: "bg-accent-soft", fg: "text-accent" },
  seasonal_word: { kanji: "季", bg: "bg-pink-100", fg: "text-pink-600" },
  life_situation: { kanji: "生", bg: "bg-violet-100", fg: "text-violet-600" },
  life_housing: { kanji: "家", bg: "bg-amber-soft", fg: "text-amber" },
  life_banking: { kanji: "銀", bg: "bg-leaf-soft", fg: "text-leaf" },
  life_tax: { kanji: "税", bg: "bg-orange-100", fg: "text-orange-600" },
  time_greeting: { kanji: "時", bg: "bg-indigo-100", fg: "text-indigo-600" },
  nhk_news: { kanji: "報", bg: "bg-rose-100", fg: "text-rose-600" },
};

const FALLBACK = { kanji: "日", bg: "bg-ink/5", fg: "text-ink/60" };

export function WidgetKindIcon({
  kind,
  size = "md",
}: {
  kind: string;
  size?: "sm" | "md";
}) {
  const cfg = WIDGET_ICON_MAP[kind] ?? FALLBACK;
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";

  return (
    <span
      aria-hidden="true"
      className={`jp-text flex shrink-0 items-center justify-center rounded-xl font-bold ${dim} ${cfg.bg} ${cfg.fg}`}
    >
      {cfg.kanji}
    </span>
  );
}
