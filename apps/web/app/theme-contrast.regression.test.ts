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
