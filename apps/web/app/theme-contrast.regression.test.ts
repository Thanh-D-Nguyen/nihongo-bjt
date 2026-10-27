import { readFileSync } from "node:fs";
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
