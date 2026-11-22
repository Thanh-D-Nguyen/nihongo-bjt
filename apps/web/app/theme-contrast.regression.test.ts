import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
function luminance(hex: string) {
 const [r, g, b] = hex.match(/[a-f\d]{2}/gi)!.map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
 return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
describe("dark theme contrast", () => {
 it("keeps white primary-control labels above the small-text contrast threshold", () => {
  const dark = css.match(/\.dark \{([\s\S]*?)\n\}/)![1];
  const files = [
   "[locale]/_components/homepage/push-prompt-banner.tsx", "[locale]/news/[id]/_components/nhk-article-detail-client.tsx",
   "[locale]/exercises/_components/exercises-page-client.tsx", "[locale]/analytics/analytics-client.tsx",
   "[locale]/login/page.tsx", "[locale]/flashcards/_components/deck-detail-client.tsx",
   "[locale]/settings/appearance/_components/appearance-settings-client.tsx"
  ];
  for (const file of files) {
   const lines = readFileSync(new URL(file, import.meta.url), "utf8").split("\n").filter(line => line.includes("text-white"));
   for (const line of lines) {
    for (const match of line.matchAll(/(?:bg|from|to)-(action-hover|action|accent|sakura)(?:\/\d+)?\b/g)) {
     const pattern = new RegExp(`--color-${match[1]}: (#[a-f0-9]+)`);
     const color = (dark.match(pattern) ?? css.match(pattern))![1];
     expect(1.05 / (luminance(color) + 0.05), `${file}: white on ${match[1]}`).toBeGreaterThanOrEqual(4.5);
    }
   }
  }
 });
 it("keeps small secondary text readable on the surface", () => {
  const dark = css.match(/\.dark \{([\s\S]*?)\n\}/)![1];
  const token = (name: string) => dark.match(new RegExp(`--color-${name}: (#[a-f0-9]+)`))![1];
  expect((luminance(token("subtle")) + 0.05) / (luminance(token("surface")) + 0.05)).toBeGreaterThanOrEqual(4.5);
 });
 it("keeps homepage news and progress links readable on dark surfaces", () => {
  for (const file of ["[locale]/_components/homepage/featured-news-section.tsx", "[locale]/_components/homepage/progress-section.tsx"]) {
   const source = readFileSync(new URL(file, import.meta.url), "utf8");
   expect(source, file).not.toContain("text-[#3B82F6]");
  }
  const dark = css.match(/\.dark \{([\s\S]*?)\n\}/)![1];
  const token = (name: string) => dark.match(new RegExp(`--color-${name}: (#[a-f0-9]+)`))![1];
  expect((luminance(token("accent")) + 0.05) / (luminance(token("surface")) + 0.05)).toBeGreaterThanOrEqual(4.5);
 });
 it("preserves the white background of the guest progress action in dark mode", () => {
  const source = readFileSync(new URL("[locale]/_components/homepage/progress-section.tsx", import.meta.url), "utf8");
  const action = source.split("\n").find(line => line.includes("bg-white") && line.includes("text-[#1B2A4A]"));
  expect(action).toContain("dark:bg-white");
 });
 it("uses the dark-aware warning text utility for NHK summaries", () => {
  const source = readFileSync(new URL("[locale]/news/[id]/_components/nhk-article-detail-client.tsx", import.meta.url), "utf8");
  const warning = source.split("\n").find(line => line.includes("bg-amber-50") && line.includes("border-amber-200"));
  expect(warning).toContain("text-amber-800");
 });
 it("uses the theme foreground for Japanese text in daily radar cards", () => {
  const source = readFileSync(new URL("../src/features/daily-radar/daily-radar-section.tsx", import.meta.url), "utf8");
  const japanese = source.split("\n").find(line => line.includes("{card.japaneseText}"));
  expect(japanese).toContain("text-ink");
 });
 it("uses a dark surface for daily radar card gradients", () => {
  expect(css).toMatch(/:is\(\.dark\) \.daily-radar-card\s*\{[^}]*background-image:\s*none/s);
 });
 it("keeps dark radar badge text and translucent overlays readable", () => {
  expect(css).toContain(".daily-radar-card .radar-badge");
  expect(css).toContain(".daily-radar-card .radar-overlay");
 });
 it("uses the dark-aware badge on category headings", () => {
  const source = readFileSync(new URL("../src/features/daily-radar/daily-radar-section.tsx", import.meta.url), "utf8");
  const heading = source.split("\n").find(line => line.includes("text-xs font-bold ring-1") && line.includes("theme.badge"));
  expect(heading).toContain("radar-badge");
 });
});

const webRoot = new URL("../", import.meta.url);
const tsxSources = ["app", "src", "components"].flatMap(dir => {
 try {
  return (readdirSync(new URL(`${dir}/`, webRoot), { recursive: true }) as string[])
   .filter(file => file.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(file))
   .map(file => `${dir}/${file}`);
 } catch {
  return [];
 }
});
const lightBlock = css.match(/@theme \{([\s\S]*?)\n\}/)![1];
const darkBlock = css.match(/\.dark \{([\s\S]*?)\n\}/)![1];
const fallbackBlock = css.match(/html:not\(\.dark\):not\(\[data-theme="light"\]\) \{([\s\S]*?)\n {2}\}/)![1];
const tokenIn = (block: string, name: string) => block.match(new RegExp(`--color-${name}: (#[a-f0-9]{6})`))?.[1];
const contrast = (a: string, b: string) => {
 const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
 return (hi + 0.05) / (lo + 0.05);
};
const sourceLines = (file: string) => readFileSync(new URL(file, webRoot), "utf8").split("\n");

describe("light and dark contrast across all learner components", () => {
 it("scans every learner tsx component", () => {
  expect(tsxSources.length, "the contrast scan must cover the whole learner app").toBeGreaterThan(250);
 });

 it("keeps white labels on filled accent/action controls at 4.5:1 in both themes", () => {
  const failures: string[] = [];
  for (const file of tsxSources) {
   sourceLines(file).forEach((line, index) => {
    if (!/(?<![\w-])text-white(?![\w-])/.test(line)) return;
    for (const match of line.matchAll(/(?<![\w-])(?:bg|from|to)-(action-hover|action|accent-hover|accent-mid|accent)(?:\/\d+)?(?![\w-])/g)) {
     const light = tokenIn(lightBlock, match[1])!;
     const dark = tokenIn(darkBlock, match[1]) ?? light;
     for (const [theme, color] of [["light", light], ["dark", dark]] as const) {
      const ratio = contrast("#ffffff", color);
      if (ratio < 4.5) failures.push(`${file}:${index + 1} white on ${match[1]} (${theme} ${ratio.toFixed(2)})`);
     }
    }
   });
  }
  expect(failures, "white on filled accent/action controls must reach 4.5:1").toEqual([]);
 });

 it("uses slate-500 instead of light-mode slate-400 for the audited small text labels", () => {
  const audited = [
   "app/[locale]/_components/homepage/bjt-levels-section.tsx",
   "app/[locale]/_components/homepage/featured-news-section.tsx",
   "app/[locale]/_components/vocab-expression-list.tsx",
   "src/features/daily-radar/daily-radar-section.tsx"
  ];
  const failures: string[] = [];
  for (const file of audited) {
   sourceLines(file).forEach((line, index) => {
    const lightSlate400 = /(?<![\w:-])text-slate-400(?![\w-])/.test(line);
    const textSized = /(?<![\w:-])text-(?:xs|sm|base|\[\d+px\])(?![\w-])/.test(line);
    if (lightSlate400 && textSized) failures.push(`${file}:${index + 1}`);
   });
  }
  expect(contrast("#64748b", "#ffffff"), "slate-500 on white").toBeGreaterThanOrEqual(4.5);
  expect(failures, "light-mode slate-400 text labels (3.0:1) must use slate-500").toEqual([]);
 });

 it("keeps leaf and sakura text readable on their soft chip backgrounds in both themes", () => {
  const failures: string[] = [];
  for (const file of tsxSources) {
   sourceLines(file).forEach((line, index) => {
    for (const bg of line.matchAll(/(?<![\w:-])bg-(leaf|sakura)-soft(?:\/\d+)?(?![\w-])/g)) {
     const family = bg[1];
     for (const text of line.matchAll(new RegExp(`(?<![\\w:-])text-(${family}(?:-strong)?)(?![\\w-])`, "g"))) {
      const light = tokenIn(lightBlock, text[1]);
      const dark = tokenIn(darkBlock, text[1]);
      if (!light || !dark) {
       failures.push(`${file}:${index + 1} text-${text[1]} token missing`);
       continue;
      }
      const lightRatio = contrast(light, tokenIn(lightBlock, `${family}-soft`)!);
      const darkRatio = contrast(dark, tokenIn(darkBlock, `${family}-soft`)!);
      if (lightRatio < 4.5) failures.push(`${file}:${index + 1} text-${text[1]} on ${family}-soft (light ${lightRatio.toFixed(2)})`);
      if (darkRatio < 4.5) failures.push(`${file}:${index + 1} text-${text[1]} on ${family}-soft (dark ${darkRatio.toFixed(2)})`);
     }
    }
   });
  }
  expect(failures, "soft chip text must reach 4.5:1").toEqual([]);
 });

 it("keeps leaf chips unchanged in dark mode and the strong chip tokens in sync with the system fallback", () => {
  expect(tokenIn(darkBlock, "leaf-strong"), "leaf-strong dark must equal the existing dark leaf").toBe(tokenIn(darkBlock, "leaf"));
  for (const family of ["leaf", "sakura"]) {
   expect(tokenIn(fallbackBlock, `${family}-strong`), `${family}-strong system fallback`).toBe(tokenIn(darkBlock, `${family}-strong`));
  }
 });
});

describe("WEB-434 dark-mode contrast and token regressions", () => {
 it("uses only defined app color tokens across magazine pages and components", () => {
  const magazineFiles = (readdirSync(new URL("[locale]/magazine/", import.meta.url), { recursive: true }) as string[])
   .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.(test|spec)\.(ts|tsx)$/.test(file))
   .map((file) => `app/[locale]/magazine/${file}`);
  expect(magazineFiles.length, "magazine directory must have source files").toBeGreaterThan(5);

  const undefinedToken = /(?<![\w-])(?:bg|text|border|ring|from|to|via|shadow)-(?:card|foreground|primary-foreground|primary|muted-foreground|background|accent-foreground|destructive)(?:\/\d+)?(?![\w-])/;
  const shadcnAccentMisuse = /(?<![\w:-])(?:bg-muted(?:\/\d+)?|hover:bg-accent(?![\w-/])|bg-accent\/60)(?![\w-])/;
  const failures: string[] = [];

  for (const file of magazineFiles) {
   sourceLines(file).forEach((line, index) => {
    const match = line.match(undefinedToken) ?? line.match(shadcnAccentMisuse);
    if (match) failures.push(`${file}:${index + 1} (${match[0]})`);
   });
  }
  expect(failures, "magazine components must not use undefined shadcn tokens or mismatched shadcn accents").toEqual([]);
 });

 it("themes the explore stats ribbon and loading shimmer with dark-readable tokens", () => {
  expect(css, "explore skeleton shimmer must define a visible dark-mode variant").toMatch(
   /\.dark\s+\.explore-skeleton-shimmer\s*\{[^}]*rgba\(\s*255\s*,\s*255\s*,\s*255/s
  );
  const exploreSource = readFileSync(new URL("[locale]/explore/_components/explore-client.tsx", import.meta.url), "utf8");
  const ribbonLine = exploreSource.split("\n").find((line) => line.includes("explore-stats-ribbon"));
  expect(ribbonLine, "explore stats ribbon must use theme border-border token").toContain("border-border");
  expect(ribbonLine).toContain("from-paper");
  expect(ribbonLine).toContain("to-surface");
  expect(exploreSource).toContain("tabular-nums text-ink");
  expect(exploreSource).toContain("text-xs text-muted");

  const darkPaper = tokenIn(darkBlock, "paper")!;
  const darkSurface = tokenIn(darkBlock, "surface")!;
  const darkInk = tokenIn(darkBlock, "ink")!;
  const darkMuted = tokenIn(darkBlock, "muted")!;
  for (const bg of [darkPaper, darkSurface]) {
   expect(contrast(darkInk, bg), "explore stat number contrast in dark").toBeGreaterThanOrEqual(4.5);
   expect(contrast(darkMuted, bg), "explore stat label contrast in dark").toBeGreaterThanOrEqual(4.5);
  }
 });

 it("uses flipping theme tokens for the Kiokoto brand wordmark and mark", () => {
  const brandSource = readFileSync(new URL("_components/brand-logo.tsx", import.meta.url), "utf8");
  expect(brandSource, "brand wordmark must use a flipping token instead of hardcoded text-blue-700").not.toContain("text-blue-700");
  expect(brandSource).toContain("text-ink");
  expect(brandSource).toContain("text-brand-accent");
  expect(brandSource, "brand mark must use var(--color-brand-panel) instead of hardcoded #1B2A4A").not.toContain('fill="#1B2A4A"');

  const lightAccent = tokenIn(lightBlock, "brand-accent");
  const darkAccent = tokenIn(darkBlock, "brand-accent");
  const fallbackAccent = tokenIn(fallbackBlock, "brand-accent");
  expect(lightAccent, "light --color-brand-accent must be defined").toBeTruthy();
  expect(darkAccent, "dark --color-brand-accent must be defined").toBeTruthy();
  expect(fallbackAccent, "system fallback --color-brand-accent must match dark").toBe(darkAccent);
  expect(contrast(lightAccent!, tokenIn(lightBlock, "paper")!), "brand-accent on light paper").toBeGreaterThanOrEqual(4.5);
  expect(contrast(darkAccent!, tokenIn(darkBlock, "paper")!), "brand-accent on dark paper").toBeGreaterThanOrEqual(4.5);
 });

 it("themes companion widget surfaces without hardcoded white, slate-50, or light amber gradients", () => {
  const companionFiles = [
   "app/_components/companion-bot.tsx",
   "app/_components/companion-message.tsx",
   "app/_components/companion-chat-panel.tsx",
   "app/_components/companion-onboarding.tsx"
  ];
  const forbidden = /(?<![\w:-])(?:bg-white|bg-slate-50|from-amber-50|to-orange-50|bg-amber-50|bg-amber-100|bg-amber-200|preserve-white-bg)(?![\w/-])/;
  const failures: string[] = [];
  for (const file of companionFiles) {
   sourceLines(file).forEach((line, index) => {
    const match = line.match(forbidden);
    if (match) failures.push(`${file}:${index + 1} (${match[0]})`);
   });
  }
  expect(failures, "companion widget surfaces must use theme tokens in dark mode").toEqual([]);
 });

 it("keeps dark muted and subtle text at 4.5:1 on every *-soft surface without changing light tokens", () => {
  const softTokens = [
   "accent-soft",
   "leaf-soft",
   "success-soft",
   "matcha-soft",
   "sakura-soft",
   "danger-soft",
   "amber-soft",
   "warning-soft"
  ] as const;

  const failures: string[] = [];
  for (const fg of ["muted", "subtle", "ink"] as const) {
   const fgHex = tokenIn(darkBlock, fg)!;
   for (const bg of ["paper", "surface", ...softTokens] as const) {
    const bgHex = tokenIn(darkBlock, bg)!;
    const ratio = contrast(fgHex, bgHex);
    if (ratio < 4.5) failures.push(`dark ${fg}(${fgHex}) on ${bg}(${bgHex}) = ${ratio.toFixed(2)}`);
   }
  }
  expect(failures, "dark muted/subtle text on *-soft surfaces must reach 4.5:1").toEqual([]);

  const semanticPairs: Array<[string, string]> = [
   ["accent", "accent-soft"],
   ["leaf", "leaf-soft"],
   ["leaf-strong", "leaf-soft"],
   ["success", "success-soft"],
   ["matcha", "matcha-soft"],
   ["sakura", "sakura-soft"],
   ["sakura-strong", "sakura-soft"],
   ["danger", "danger-soft"],
   ["amber", "amber-soft"],
   ["warning", "warning-soft"]
  ];
  for (const [fg, bg] of semanticPairs) {
   expect(contrast(tokenIn(darkBlock, fg)!, tokenIn(darkBlock, bg)!), `dark ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
  for (const token of ["muted", "subtle", ...softTokens] as const) {
   expect(tokenIn(fallbackBlock, token), `${token} system fallback must match .dark`).toBe(tokenIn(darkBlock, token));
  }

  // Light-mode tokens must remain untouched.
  expect(tokenIn(lightBlock, "muted")).toBe("#4b5563");
  expect(tokenIn(lightBlock, "subtle")).toBe("#9ca3af");
  expect(tokenIn(lightBlock, "accent-soft")).toBe("#dbeafe");
  expect(tokenIn(lightBlock, "leaf-soft")).toBe("#ecfdf5");
  expect(tokenIn(lightBlock, "sakura-soft")).toBe("#fef2f2");
  expect(tokenIn(lightBlock, "amber-soft")).toBe("#fffbeb");
 });

 it("migrates small-text sakura-on-soft usages to sakura-strong in the four audited files", () => {
  const audited = [
   "app/_components/ambient-mini-player.tsx",
   "app/[locale]/search/_components/search-detail-learner-actions.tsx",
   "app/[locale]/exercises/_components/exercises-page-client.tsx",
   "app/[locale]/battle/_components/battle-match-client.tsx"
  ];
  const failures: string[] = [];
  for (const file of audited) {
   const lines = sourceLines(file);
   lines.forEach((line, index) => {
    if (/(?<![\w:-])bg-sakura-soft(?:\/\d+)?(?![\w-])/.test(line) && /(?<![\w:-])text-sakura(?![\w-])/.test(line)) {
     failures.push(`${file}:${index + 1}`);
    }
   });
  }
  const exercisesSource = readFileSync(new URL("[locale]/exercises/_components/exercises-page-client.tsx", import.meta.url), "utf8");
  const wrongBlock = exercisesSource.match(/exercise-answer-wrong[\s\S]*?<\/button>/)?.[0] ?? "";
  if (/(?<![\w:-])text-sakura(?![\w-])/.test(wrongBlock)) {
   failures.push("app/[locale]/exercises/_components/exercises-page-client.tsx: nested text-sakura inside bg-sakura-soft button");
  }
  expect(failures, "sakura-on-soft text in audited files must use text-sakura-strong").toEqual([]);
 });

 it("replaces unthemed light slate/gray/white surfaces and broken hsl vars in the nine audited files", () => {
  const audited = [
   "app/_components/companion-message.tsx",
   "app/[locale]/radar/[slug]/page.tsx",
   "app/[locale]/pricing/_components/pricing-client.tsx",
   "app/[locale]/news/[id]/_components/nhk-article-detail-client.tsx",
   "app/[locale]/modules/[moduleKey]/page.tsx",
   "app/[locale]/battle/_components/game-types/custom-round.tsx",
   "app/[locale]/_components/share-drawer.tsx",
   "app/[locale]/_components/homepage/quick-actions-strip.tsx",
   "app/[locale]/_components/back-navigation.tsx"
  ];
  const unthemed = /(?<![\w:-])(?:bg-slate-(?:50|100|200|300)(?:\/\d+)?|bg-gray-(?:50|100)(?:\/\d+)?|bg-white(?![\w/-])|border-slate-(?:200|300)|border-gray-200|text-slate-(?:600|700|800|900|950))(?![\w-])|hsl\(var\(--/;
  const failures: string[] = [];
  for (const file of audited) {
   sourceLines(file).forEach((line, index) => {
    const match = line.match(unthemed);
    if (match) failures.push(`${file}:${index + 1} (${match[0]})`);
   });
  }
  expect(failures, "audited files must not keep unthemed light slate/gray/white classes or nonexistent hsl vars").toEqual([]);
 });
});

describe("WEB-435 companion mascot and speech bubble dark-mode regressions", () => {
 it("uses dark-mode theme borders and WCAG AA text contrast on the companion speech bubble while keeping light classes unchanged", () => {
  const source = readFileSync(new URL("_components/companion-speech-bubble.tsx", import.meta.url), "utf8");
  const bubbleLine = source.split("\n").find((line) => line.includes("border-ink/8") && line.includes("bg-surface"));
  expect(bubbleLine, "speech bubble body must add dark:border-border without altering light border-ink/8").toContain("dark:border-border");
  const tailLine = source.split("\n").find((line) => line.includes("rotate-45") && line.includes("bg-surface"));
  expect(tailLine, "speech bubble tail must add dark:border-border without altering light border-ink/10").toContain("dark:border-border");

  const darkSurface = tokenIn(darkBlock, "surface")!;
  const darkInk = tokenIn(darkBlock, "ink")!;
  const darkMuted = tokenIn(darkBlock, "muted")!;
  expect(contrast(darkInk, darkSurface), "speech bubble primary text contrast in dark").toBeGreaterThanOrEqual(4.5);
  expect(contrast(darkMuted, darkSurface), "speech bubble secondary text contrast in dark").toBeGreaterThanOrEqual(4.5);
 });
});

describe("WEB-436 hardcoded light-palette to theme-token regressions", () => {
 it("defines --color-amber-strong for both themes and keeps all vocab-expression-list token pairs at >= 4.5:1 without hardcoded palette utilities", () => {
  const lightAmberStrong = tokenIn(lightBlock, "amber-strong");
  const darkAmberStrong = tokenIn(darkBlock, "amber-strong");
  const fallbackAmberStrong = tokenIn(fallbackBlock, "amber-strong");

  expect(lightAmberStrong, "--color-amber-strong must be defined in light, dark, and system fallback themes").toBeTruthy();
  expect(darkAmberStrong, "--color-amber-strong must be defined in light, dark, and system fallback themes").toBeTruthy();
  expect(fallbackAmberStrong, "system fallback --color-amber-strong must match .dark").toBe(darkAmberStrong);

  const vocabPairs: Array<[string, string]> = [
   ["ink", "surface"],
   ["ink", "paper"],
   ["muted", "surface"],
   ["muted", "paper"],
   ["leaf-strong", "leaf-soft"],
   ["brand-accent", "accent-soft"],
   ["amber-strong", "amber-soft"]
  ];
  for (const [fg, bg] of vocabPairs) {
   const lightRatio = contrast(tokenIn(lightBlock, fg)!, tokenIn(lightBlock, bg)!);
   const darkRatio = contrast(tokenIn(darkBlock, fg)!, tokenIn(darkBlock, bg)!);
   expect(lightRatio, `light ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
   expect(darkRatio, `dark ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  }

  const hardcodedPalette = /(?<![\w:-])(?:(?:hover|focus|active|dark|group-hover):)?(?:bg|text|border|ring|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?:\/\d+)?(?![\w-])|(?<![\w:-])(?:hover:)?bg-white(?![\w/-])/;
  const vocabViolations: string[] = [];
  sourceLines("app/[locale]/_components/vocab-expression-list.tsx").forEach((line, index) => {
   const match = line.match(hardcodedPalette);
   if (match) vocabViolations.push(`vocab-expression-list.tsx:${index + 1} (${match[0]})`);
  });
  expect(vocabViolations, "vocab-expression-list.tsx must not contain hardcoded Tailwind palette utilities").toEqual([]);
 });

 it("migrates broken light-palette utilities, undefined vars, and dark-invisible skeletons across the audited sweep files", () => {
  const failures: string[] = [];
  if (!/\.dark\s+\.foryou-skeleton\s*\{[^}]*rgba\(\s*255\s*,\s*255\s*,\s*255/s.test(css)) {
   failures.push("app/globals.css: missing dark variant for .foryou-skeleton");
  }
  if (!/\.dark\s+\.exercise-skeleton-shimmer\s*\{[^}]*rgba\(\s*255\s*,\s*255\s*,\s*255/s.test(css)) {
   failures.push("app/globals.css: missing dark variant for .exercise-skeleton-shimmer");
  }

  const migratedSweepFiles = [
   "app/[locale]/_components/content-actions.tsx",
   "app/[locale]/_components/homepage/for-you-feed-widget.tsx",
   "app/[locale]/_components/homepage/login-bonus-widget.tsx",
   "app/[locale]/_components/homepage/progress-section.tsx",
   "app/[locale]/battle/_components/battle-configs-panel.tsx",
   "app/[locale]/battle/_components/battle-hype-layer.tsx",
   "app/[locale]/battle/_components/battle-lobby-leaderboard.tsx",
   "app/[locale]/battle/_components/game-types/speed-duel-round.tsx",
   "app/[locale]/daily/[id]/daily-detail-client.tsx",
   "app/[locale]/exercises/_components/exercises-page-client.tsx",
   "app/[locale]/flashcards/_components/deck-composer-panel.tsx",
   "app/[locale]/login/_components/login-form-client.tsx",
   "app/[locale]/magazine/loto/_components/loto-balls.tsx",
   "app/[locale]/me/_components/me-page-client.tsx",
   "app/[locale]/quiz/_components/quiz-client.tsx",
   "app/[locale]/register/_components/register-form-client.tsx",
   "app/_components/announcement-strip.tsx"
  ];

  const brokenDarkDefect = new RegExp([
   "(?<![\\w:-])bg-(?:amber|red|orange|emerald|blue)-50/",
   "(?<![\\w:-])bg-amber-100/",
   "(?<![\\w:-])bg-white/80(?![\\w/-])",
   "(?<![\\w:-])from-(?:amber|orange|emerald|indigo|violet)-(?:50|100)(?![\\w-])",
   "(?<![\\w:-])to-(?:indigo|violet|orange|blue|emerald|red|amber)-(?:50|100)(?![\\w-])",
   "hover:bg-white(?![\\w/-])",
   "hover:bg-(?:amber-100|blue-50|\\[#F3F4F6\\]|\\[#EFF6FF\\]|\\[#F9FAFB\\])",
   "active:bg-(?:amber-100/|\\[#E5E7EB\\])",
   "(?<![\\w:-])text-(?:amber|orange)-(?:900|950)(?![\\w-])",
   "(?<![\\w:-])text-slate-100(?![\\w-])",
   "(?<![\\w:-])ring-(?:emerald|amber)-(?:200|300)(?![\\w-])",
   "(?<![\\w:-])border-(?:amber-200/(?:60|90)|amber-300/40|amber-800/20|red-200/80|\\[#F3F4F6\\])",
   "bg-\\[#(?:EFF6FF|FEF2F2|F0FDF4)\\]",
   "text-\\[#(?:DC2626|16A34A)\\]",
   "--color-navy\\b",
   "hsl\\(var\\(--",
   "bg-white text-gray-900 hover:bg-white/90",
   "bg-indigo-500/10 text-indigo-700",
   "bg-amber-500/15 text-amber-700",
   "(?<![\\w:-])border-amber-400/40 bg-amber-50(?![\\w/-])"
  ].join("|"));

  for (const file of migratedSweepFiles) {
   sourceLines(file).forEach((line, index) => {
    const match = line.match(brokenDarkDefect);
    if (match) failures.push(`${file}:${index + 1} (${match[0]})`);
   });
  }
  expect(failures, "audited sweep files must not retain unmapped light-palette dark-mode defects or undefined CSS vars").toEqual([]);
 });
});
