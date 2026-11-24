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

describe("WEB-437 companion mascot dark-mode luminance and hue calibration", () => {
 type Rgb = [number, number, number];
 const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
 const parseHex = (hex: string): Rgb => {
  const parts = hex.match(/[a-f\d]{2}/gi)!.map((v) => parseInt(v, 16) / 255);
  return [parts[0], parts[1], parts[2]];
 };
 const toHex = ([r, g, b]: Rgb) =>
  `#${[r, g, b].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("")}`;
 const rgbLuminance = ([r, g, b]: Rgb) => {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
 };
 const rgbContrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [rgbLuminance(a), rgbLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
 };
 const rgbToHsl = ([r, g, b]: Rgb): [number, number, number] => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
   const d = max - min;
   s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
   if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
   else if (max === g) h = ((b - r) / d + 2) * 60;
   else h = ((r - g) / d + 4) * 60;
  }
  return [h, s * 100, l * 100];
 };
 // W3C Filter Effects Level 1 sRGB pipeline in Tailwind v4 order: brightness -> contrast -> saturate.
 const applyFilterRaw = ([r0, g0, b0]: Rgb, B: number, C: number, S: number) => {
  const r = clamp01((clamp01(r0 * B) - 0.5) * C + 0.5);
  const g = clamp01((clamp01(g0 * B) - 0.5) * C + 0.5);
  const b = clamp01((clamp01(b0 * B) - 0.5) * C + 0.5);
  const raw: Rgb = [
   (0.213 + 0.787 * S) * r + (0.715 - 0.715 * S) * g + (0.072 - 0.072 * S) * b,
   (0.213 - 0.213 * S) * r + (0.715 + 0.285 * S) * g + (0.072 - 0.072 * S) * b,
   (0.213 - 0.213 * S) * r + (0.715 - 0.715 * S) * g + (0.072 + 0.928 * S) * b,
  ];
  return { raw, clamped: raw.map(clamp01) as Rgb };
 };

 it("keeps the baked #E0E0E0 artboard at <= 0.22 luminance in dark mode while preserving coral #EC5264 hue and cream face readability", () => {
  const source = readFileSync(new URL("_components/battle-bot-avatar.tsx", import.meta.url), "utf8");
  const B = Number(source.match(/dark:brightness-\[([\d.]+)\]/)?.[1]);
  const C = Number(source.match(/dark:contrast-\[([\d.]+)\]/)?.[1]);
  const S = Number(source.match(/dark:saturate-\[([\d.]+)\]/)?.[1]);
  expect(Number.isFinite(B) && Number.isFinite(C) && Number.isFinite(S), "dark canvas filter values must be declared").toBe(true);

  const bg = applyFilterRaw(parseHex("#E0E0E0"), B, C, S).clamped;
  const coralRes = applyFilterRaw(parseHex("#EC5264"), B, C, S);
  const coral = coralRes.clamped;
  const face = applyFilterRaw(parseHex("#F5F3F1"), B, C, S).clamped;
  const shade = applyFilterRaw(parseHex("#CEC3B8"), B, C, S).clamped;
  const white = applyFilterRaw(parseHex("#FFFFFF"), B, C, S).clamped;
  const outline = applyFilterRaw(parseHex("#141414"), B, C, S).clamped;

  const bgLum = rgbLuminance(bg);
  expect(
   bgLum,
   `baked #E0E0E0 artboard rendered luminance (${toHex(bg)}, L=${bgLum.toFixed(4)}) must be <= 0.22 in dark mode`,
  ).toBeLessThanOrEqual(0.22);
  expect(
   bgLum,
   `baked #E0E0E0 artboard rendered luminance (${toHex(bg)}, L=${bgLum.toFixed(4)}) should be <= #6b7280 (0.1672)`,
  ).toBeLessThanOrEqual(luminance("#6b7280"));

  const [origCoralH] = rgbToHsl(parseHex("#EC5264"));
  const [coralH, coralS] = rgbToHsl(coral);
  const rawDelta = Math.abs(coralH - origCoralH);
  const hueDelta = rawDelta > 180 ? 360 - rawDelta : rawDelta;
  expect(coralH >= 345 || coralH <= 10, `coral #EC5264 hue (${coralH.toFixed(1)}°) must stay in red-coral family`).toBe(true);
  expect(hueDelta, `coral hue drift (${hueDelta.toFixed(1)}°) must stay <= 5°`).toBeLessThanOrEqual(5);
  expect(coralS, `coral saturation (${coralS.toFixed(1)}%) must remain vibrant (>= 60%)`).toBeGreaterThanOrEqual(60);
  expect(
   coralRes.raw.every((channel) => channel > 0 && channel < 1),
   `coral RGB channels (${coralRes.raw.map((v) => v.toFixed(3)).join(",")}) must not clip`,
  ).toBe(true);

  expect(rgbLuminance(face), "cream face must remain brighter than artboard background").toBeGreaterThan(bgLum);
  expect(rgbContrast(face, bg), "cream face vs artboard background contrast").toBeGreaterThanOrEqual(1.15);
  expect(rgbContrast(face, coral), "cream face vs coral body contrast").toBeGreaterThanOrEqual(2.0);
  expect(rgbContrast(face, shade), "cream face vs face shade contrast").toBeGreaterThanOrEqual(1.45);
  expect(rgbContrast(white, bg), "white sclera vs artboard background contrast").toBeGreaterThanOrEqual(1.25);
  expect(rgbContrast(bg, outline), "artboard background vs dark outline contrast").toBeGreaterThanOrEqual(3.5);
 });
});

describe("WEB-439 scenarios answer-flow contrast sweep", () => {
 type Rgb = [number, number, number];
 const parseRgb = (hex: string): Rgb => {
  const parts = hex.match(/[a-f\d]{2}/gi)!.map((v) => parseInt(v, 16) / 255);
  return [parts[0], parts[1], parts[2]];
 };
 const blendRgb = (fgHex: string, alpha: number, bgRgb: Rgb): Rgb => {
  const fg = parseRgb(fgHex);
  return [
   fg[0] * alpha + bgRgb[0] * (1 - alpha),
   fg[1] * alpha + bgRgb[1] * (1 - alpha),
   fg[2] * alpha + bgRgb[2] * (1 - alpha),
  ];
 };
 const rgbLum = ([r, g, b]: Rgb) => {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
 };
 const rgbCr = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [rgbLum(a), rgbLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
 };

 it("defines --color-matcha-strong for both themes without changing --color-matcha and meets WCAG AA ratios across all scenario token pairs", () => {
  const lightMatchaStrong = tokenIn(lightBlock, "matcha-strong");
  const darkMatchaStrong = tokenIn(darkBlock, "matcha-strong");
  const fallbackMatchaStrong = tokenIn(fallbackBlock, "matcha-strong");

  expect(lightMatchaStrong, "--color-matcha-strong must be defined in light, dark, and system fallback themes").toBe("#15803d");
  expect(darkMatchaStrong, "--color-matcha-strong must be defined in light, dark, and system fallback themes").toBe("#15853e");
  expect(fallbackMatchaStrong, "system fallback --color-matcha-strong must match .dark").toBe(darkMatchaStrong);

  // Base --color-matcha must NOT be changed (out-of-scope features depend on it).
  expect(tokenIn(lightBlock, "matcha"), "light --color-matcha must remain unchanged").toBe("#22c55e");
  expect(tokenIn(darkBlock, "matcha"), "dark --color-matcha must remain unchanged").toBe("#4ade80");
  expect(tokenIn(fallbackBlock, "matcha"), "fallback --color-matcha must remain unchanged").toBe("#4ade80");

  const white = parseRgb("#ffffff");
  const themes = [
   { name: "light", block: lightBlock },
   { name: "dark", block: darkBlock },
  ] as const;

  for (const { name, block } of themes) {
   const ink = tokenIn(block, "ink")!;
   const muted = tokenIn(block, "muted")!;
   const paper = parseRgb(tokenIn(block, "paper")!);
   const surface = parseRgb(tokenIn(block, "surface")!);
   const matcha = tokenIn(block, "matcha")!;
   const matchaSoft = parseRgb(tokenIn(block, "matcha-soft")!);
   const matchaStrong = tokenIn(block, "matcha-strong")!;
   const sakura = tokenIn(block, "sakura")!;
   const sakuraSoft = parseRgb(tokenIn(block, "sakura-soft")!);
   const sakuraStrong = tokenIn(block, "sakura-strong")!;
   const amberSoft = parseRgb(tokenIn(block, "amber-soft")!);
   const amberStrong = tokenIn(block, "amber-strong")!;

   const matcha10Paper = blendRgb(matcha, 0.1, paper);
   const sakura10Paper = blendRgb(sakura, 0.1, paper);
   const matcha10Surface = blendRgb(matcha, 0.1, surface);
   const sakura10Surface = blendRgb(sakura, 0.1, surface);
   const trackPaper = blendRgb(ink, 0.1, paper);

   // 1. Primary buttons (white on matcha-strong) — before: 2.28 light / 1.74 dark; after: 5.02 light / 4.71 dark.
   expect(rgbCr(white, parseRgb(matcha)), `${name} before: white on base matcha failed AA`).toBeLessThan(4.5);
   expect(rgbCr(white, parseRgb(matchaStrong)), `${name} after: white on matcha-strong`).toBeGreaterThanOrEqual(4.5);

   // 2. Choice key prefix (ink/70 vs ink/40) — before: 2.52 / 3.58; after: 6.44 / 8.41 (paper), >=5.97 (tints).
   expect(rgbCr(blendRgb(ink, 0.4, paper), paper), `${name} before: ink/40 on paper failed AA`).toBeLessThan(4.5);
   for (const [bgName, bg] of [
    ["paper", paper],
    ["surface", surface],
    ["matcha/10(paper)", matcha10Paper],
    ["sakura/10(paper)", sakura10Paper],
   ] as const) {
    expect(rgbCr(blendRgb(ink, 0.7, bg), bg), `${name} after: ink/70 on ${bgName}`).toBeGreaterThanOrEqual(4.5);
   }

   // 3. Level badges (beginner, intermediate, advanced, unknown fallback).
   const badgeMatchaText = name === "light" ? matchaStrong : matcha;
   expect(rgbCr(parseRgb(badgeMatchaText), matchaSoft), `${name} after: beginner badge on matcha-soft`).toBeGreaterThanOrEqual(4.5);
   expect(rgbCr(parseRgb(amberStrong), amberSoft), `${name} after: intermediate badge on amber-soft`).toBeGreaterThanOrEqual(4.5);
   expect(rgbCr(parseRgb(sakuraStrong), sakuraSoft), `${name} after: advanced badge on sakura-soft`).toBeGreaterThanOrEqual(4.5);
   expect(rgbCr(parseRgb(ink), blendRgb(ink, 0.1, surface)), `${name} after: fallback badge on ink/10(surface)`).toBeGreaterThanOrEqual(4.5);

   // 4 & 6b. Selected-choice and feedback-panel state borders (matcha-strong / sakura-strong) vs paper AND inner tint.
   expect(rgbCr(parseRgb(matchaStrong), paper), `${name} after: optimal border matcha-strong vs paper`).toBeGreaterThanOrEqual(3.0);
   expect(rgbCr(parseRgb(matchaStrong), matcha10Paper), `${name} after: optimal border matcha-strong vs matcha/10(paper)`).toBeGreaterThanOrEqual(3.0);
   expect(rgbCr(parseRgb(sakuraStrong), paper), `${name} after: suboptimal border sakura-strong vs paper`).toBeGreaterThanOrEqual(3.0);
   expect(rgbCr(parseRgb(sakuraStrong), sakura10Paper), `${name} after: suboptimal border sakura-strong vs sakura/10(paper)`).toBeGreaterThanOrEqual(3.0);
   expect(rgbCr(blendRgb(matcha, 0.2, paper), paper), `${name} before: feedback matcha/20 border failed 3:1`).toBeLessThan(3.0);
   expect(rgbCr(blendRgb(sakura, 0.2, paper), paper), `${name} before: feedback sakura/20 border failed 3:1`).toBeLessThan(3.0);

   // 5. Error text (sakura-strong on paper).
   expect(rgbCr(parseRgb(sakuraStrong), paper), `${name} after: error text sakura-strong on paper`).toBeGreaterThanOrEqual(4.5);

   // 6a. Feedback verdict (explicit text-ink) and feedback body (text-muted) on tinted panels.
   expect(rgbCr(parseRgb(ink), matcha10Paper), `${name} after: verdict ink on matcha/10(paper)`).toBeGreaterThanOrEqual(4.5);
   expect(rgbCr(parseRgb(ink), sakura10Paper), `${name} after: verdict ink on sakura/10(paper)`).toBeGreaterThanOrEqual(4.5);
   expect(rgbCr(parseRgb(muted), matcha10Paper), `${name} after: feedback muted on matcha/10(paper)`).toBeGreaterThanOrEqual(4.5);
   expect(rgbCr(parseRgb(muted), sakura10Paper), `${name} after: feedback muted on sakura/10(paper)`).toBeGreaterThanOrEqual(4.5);

   // 7. Progress bar fill (matcha-strong in light, matcha in dark) on ink/10 track.
   const progressFill = name === "light" ? matchaStrong : matcha;
   expect(rgbCr(parseRgb(progressFill), trackPaper), `${name} after: progress fill on ink/10(paper)`).toBeGreaterThanOrEqual(3.0);

   // 8. Summary score readout (matcha-strong in light, matcha in dark) on surface.
   const summaryScore = name === "light" ? matchaStrong : matcha;
   expect(rgbCr(parseRgb(summaryScore), surface), `${name} after: summary score on surface`).toBeGreaterThanOrEqual(4.5);

   // 9. Summary per-step result rows (explicit text-ink + strong state borders vs surface & inner tint).
   const summaryOptimalBorder = name === "light" ? matchaStrong : matcha;
   expect(rgbCr(parseRgb(summaryOptimalBorder), surface), `${name} after: summary optimal border vs surface`).toBeGreaterThanOrEqual(3.0);
   expect(rgbCr(parseRgb(summaryOptimalBorder), matcha10Surface), `${name} after: summary optimal border vs matcha/10(surface)`).toBeGreaterThanOrEqual(3.0);
   expect(rgbCr(parseRgb(sakuraStrong), surface), `${name} after: summary suboptimal border vs surface`).toBeGreaterThanOrEqual(3.0);
   expect(rgbCr(parseRgb(sakuraStrong), sakura10Surface), `${name} after: summary suboptimal border vs sakura/10(surface)`).toBeGreaterThanOrEqual(3.0);
   expect(rgbCr(parseRgb(ink), matcha10Surface), `${name} after: summary optimal text-ink`).toBeGreaterThanOrEqual(4.5);
   expect(rgbCr(parseRgb(ink), sakura10Surface), `${name} after: summary suboptimal text-ink`).toBeGreaterThanOrEqual(4.5);

   // 10. Retry buttons and secondary metadata (step counter, speaker role, empty/back text).
   expect(rgbCr(parseRgb(ink), surface), `${name} after: retry/primary ink on surface`).toBeGreaterThanOrEqual(4.5);
   expect(rgbCr(parseRgb(muted), paper), `${name} after: secondary muted text on paper`).toBeGreaterThanOrEqual(4.5);
   expect(rgbCr(parseRgb(muted), surface), `${name} after: secondary muted text on surface`).toBeGreaterThanOrEqual(4.5);
  }

  // Pin light-mode before-state failures explicitly so regressions cannot hide behind averages.
  const lightSurface = parseRgb(tokenIn(lightBlock, "surface")!);
  const lightPaper = parseRgb(tokenIn(lightBlock, "paper")!);
  expect(rgbCr(parseRgb("#22c55e"), blendRgb("#22c55e", 0.15, lightSurface)), "before light beginner badge failed AA").toBeLessThan(4.5);
  expect(rgbCr(parseRgb("#f59e0b"), blendRgb("#f59e0b", 0.15, lightSurface)), "before light intermediate #f59e0b badge failed AA").toBeLessThan(4.5);
  expect(rgbCr(parseRgb("#dc2626"), blendRgb("#dc2626", 0.15, lightSurface)), "before light advanced badge failed AA").toBeLessThan(4.5);
  expect(rgbCr(parseRgb("#f87171"), blendRgb("#f87171", 0.15, parseRgb(tokenIn(darkBlock, "surface")!))), "before dark advanced badge failed AA").toBeLessThan(4.5);
  expect(rgbCr(parseRgb("#22c55e"), lightPaper), "before light optimal border failed 3:1").toBeLessThan(3.0);
  expect(rgbCr(parseRgb("#22c55e"), blendRgb(tokenIn(lightBlock, "ink")!, 0.1, lightPaper)), "before light progress fill failed 3:1").toBeLessThan(3.0);
  expect(rgbCr(parseRgb("#22c55e"), lightSurface), "before light summary score failed 3:1").toBeLessThan(3.0);
 });

 it("migrates scenario-play-client.tsx off low-contrast base tokens and pins explicit verdict, error, progress, and summary contrast", () => {
  const file = "app/[locale]/scenarios/[scenarioId]/_components/scenario-play-client.tsx";
  const source = readFileSync(new URL(file, webRoot), "utf8");
  const lines = source.split("\n");

  const forbidden = new RegExp([
   "bg-\\[var\\(--color-matcha\\)\\](?!/)",
   "(?<![\\w:-])bg-matcha(?![\\w/-])",
   "(?<![\\w:-])text-ink/40(?![\\w-])",
   "(?<![\\w:-])text-\\[var\\(--color-matcha\\)\\]",
   "(?<![\\w:-])text-matcha(?![\\w-])",
   "(?<![\\w:-])text-\\[var\\(--color-sakura\\)\\]",
   "(?<![\\w:-])text-sakura(?![\\w-])",
   "(?<![\\w:-])border-\\[var\\(--color-matcha\\)\\](?:/\\d+)?",
   "(?<![\\w:-])border-matcha(?:/\\d+)?(?![\\w-])",
   "(?<![\\w:-])border-\\[var\\(--color-sakura\\)\\](?:/\\d+)?",
   "(?<![\\w:-])border-sakura(?:/\\d+)?(?![\\w-])",
  ].join("|"));

  const violations: string[] = [];
  lines.forEach((line, index) => {
   const match = line.match(forbidden);
   if (match) violations.push(`scenario-play-client.tsx:${index + 1} (${match[0]})`);
  });
  expect(violations, "scenario-play-client.tsx must not retain sub-AA matcha/sakura base tokens or text-ink/40").toEqual([]);

  // Pin every required fix in scenario-play-client.tsx.
  const primaryMatchaButtons = lines.filter((l) => l.includes("bg-matcha-strong") && l.includes("text-white"));
  expect(primaryMatchaButtons.length, "both Replay and Next/Show Result primary buttons must use bg-matcha-strong text-white").toBeGreaterThanOrEqual(2);
  expect(source, "choice key letter must use text-ink/70").toContain("text-ink/70");
  expect(source, "selected optimal choice and feedback borders must use border-matcha-strong").toContain("border-matcha-strong");
  expect(source, "selected suboptimal choice and feedback borders must use border-sakura-strong").toContain("border-sakura-strong");
  expect(source, "error text must use text-sakura-strong").toContain("text-sakura-strong");
  expect(source, "progress bar fill must use bg-matcha-strong dark:bg-matcha").toContain("bg-matcha-strong dark:bg-matcha");
  expect(source, "summary score must use text-matcha-strong dark:text-matcha").toContain("text-matcha-strong dark:text-matcha");

  const verdictLine = lines.find((l) => l.includes("font-bold text-xs") && l.includes("text-ink"));
  expect(verdictLine, "feedback verdict line must specify explicit text-ink").toBeTruthy();

  const summaryRowLine = lines.find((l) => l.includes("rounded-xl border p-3 text-xs text-ink"));
  expect(summaryRowLine, "summary step rows must specify explicit border and text-ink").toBeTruthy();
 });

 it("migrates scenario-list-client.tsx difficulty badges and error retry controls to WCAG AA theme tokens", () => {
  const file = "app/[locale]/scenarios/_components/scenario-list-client.tsx";
  const source = readFileSync(new URL(file, webRoot), "utf8");
  const lines = source.split("\n");

  const forbidden = new RegExp([
   "--color-gold",
   "#f59e0b",
   "bg-\\[var\\(--color-matcha\\)\\]/15",
   "bg-\\[var\\(--color-sakura\\)\\]/15",
   "(?<![\\w:-])text-\\[var\\(--color-matcha\\)\\]",
   "(?<![\\w:-])text-\\[var\\(--color-sakura\\)\\]",
   "(?<![\\w:-])text-matcha(?![\\w-])",
   "(?<![\\w:-])text-sakura(?![\\w-])",
  ].join("|"));

  const violations: string[] = [];
  lines.forEach((line, index) => {
   const match = line.match(forbidden);
   if (match) violations.push(`scenario-list-client.tsx:${index + 1} (${match[0]})`);
  });
  expect(violations, "scenario-list-client.tsx must not retain low-contrast badge tokens or undefined --color-gold").toEqual([]);

  expect(source, "beginner badge must use bg-matcha-soft text-matcha-strong dark:text-matcha").toContain("bg-matcha-soft text-matcha-strong dark:text-matcha");
  expect(source, "intermediate badge must use bg-amber-soft text-amber-strong").toContain("bg-amber-soft text-amber-strong");
  expect(source, "advanced badge must use bg-sakura-soft text-sakura-strong").toContain("bg-sakura-soft text-sakura-strong");
  expect(source, "load error message must use text-sakura-strong").toContain("text-sakura-strong");
  const retryBlock = source.match(/role="alert"[\s\S]*?<button([\s\S]*?)<\/button>/)?.[1] ?? "";
  expect(retryBlock, "retry button must specify explicit text-ink and surface/border tokens").toContain("text-ink");
  expect(retryBlock, "retry button must specify bg-surface").toContain("bg-surface");
  expect(retryBlock, "retry button must specify border-border").toContain("border-border");
 });
});

describe("WEB-449 Career RPG question card dark-mode contrast", () => {
 it("keeps all card text/background pairs >= 4.5:1 and selected border >= 3:1 in both light and dark modes", () => {
  const cardSource = readFileSync(
   new URL("../src/features/career-rpg/components/bjt-style-question-card.tsx", import.meta.url),
   "utf8"
  );
  expect(cardSource, "question card must not contain hardcoded hex colors").not.toMatch(/#[0-9a-f]{3,8}/i);
  expect(cardSource, "question card must not use unthemed bg-white").not.toMatch(/(?<![\w:-])bg-white(?![\w/-])/);

  // Record original failure: dark ink (#f1f5f9) on old hardcoded picked bg (#EEF2FF) is ~1.1:1.
  expect(contrast(tokenIn(darkBlock, "ink")!, "#eef2ff"), "pre-fix dark ink on #EEF2FF").toBeLessThan(4.5);

  for (const [theme, block] of [
   ["light", lightBlock],
   ["dark", darkBlock]
  ] as const) {
   const ink = tokenIn(block, "ink")!;
   const muted = tokenIn(block, "muted")!;
   const surface = tokenIn(block, "surface")!;
   const paper = tokenIn(block, "paper")!;
   const accentSoft = tokenIn(block, "accent-soft")!;
   const brandPanel = tokenIn(block, "brand-panel")!;
   const brandNavy = tokenIn(block, "brand-navy")!;

   expect(contrast(ink, accentSoft), `${theme} ink on accent-soft (picked option)`).toBeGreaterThanOrEqual(4.5);
   expect(contrast("#ffffff", brandPanel), `${theme} white on brand-panel (picked badge)`).toBeGreaterThanOrEqual(4.5);
   expect(contrast(ink, surface), `${theme} ink on surface`).toBeGreaterThanOrEqual(4.5);
   expect(contrast(ink, paper), `${theme} ink on paper`).toBeGreaterThanOrEqual(4.5);
   expect(contrast(muted, paper), `${theme} muted on paper (unpicked badge)`).toBeGreaterThanOrEqual(4.5);
   expect(contrast(muted, surface), `${theme} muted on surface`).toBeGreaterThanOrEqual(4.5);

   expect(contrast(brandNavy, surface), `${theme} brand-navy border on surface`).toBeGreaterThanOrEqual(3);
   expect(contrast(brandNavy, accentSoft), `${theme} brand-navy border on accent-soft`).toBeGreaterThanOrEqual(3);
  }

  for (const token of ["accent-soft", "brand-panel", "brand-navy"] as const) {
   expect(tokenIn(fallbackBlock, token), `${token} system fallback must match .dark`).toBe(tokenIn(darkBlock, token));
  }
 });
});
