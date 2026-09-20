import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { BjtQuestionImageBrief } from "./bjt-question-image-metadata.js";

export const DETERMINISTIC_RENDERER_VERSION = "1.0.0";
const WIDTH = 1600;
const HEIGHT = 900;
const ARCHETYPES = new Set([
  "schedule", "table", "chart", "email", "notice", "form", "diagram", "map_layout", "document"
  , "illustration", "workplace_photo", "workplace_interaction", "meeting", "office_environment", "object_scene"
]);

export interface DeterministicRenderResult {
  rendererType: string;
  rendererVersion: string;
  briefHashSha256: string;
  outputChecksumSha256: string;
  width: number;
  height: number;
  contentId: string;
  generatedPath: string;
  svg: string;
}

export type DeterministicStimulusType =
  | "chart" | "table" | "schedule" | "email" | "notice" | "form" | "diagram" | "map_layout" | "document";

export interface DeterministicRenderAcceptance {
  structuralStatus: "ACCEPT" | "STALE" | "INVALID";
  pedagogicalStatus: "ACCEPT" | "REVISE_TEMPLATE" | "REVISE_BRIEF" | "HUMAN_REVIEW";
  reason: string;
}

export type DeterministicPedagogicalStatus = "ACCEPT" | "REVISE_TEMPLATE" | "REVISE_BRIEF" | "HUMAN_REVIEW";

export interface DeterministicAcceptanceRecord {
  structuralStatus: "ACCEPT" | "STALE" | "INVALID";
  pedagogicalStatus: DeterministicPedagogicalStatus;
  pedagogicalReason: string;
}

export interface DeterministicRenderProvenance {
  rendererType: string;
  rendererVersion: string;
  briefHashSha256: string;
  outputChecksumSha256: string;
  width: number;
  height: number;
  contentId: string;
  generatedPath: string;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
}

function assertBrief(brief: BjtQuestionImageBrief): void {
  if (!brief || brief.generationMode !== "DETERMINISTIC_RENDER") throw new Error("brief must request DETERMINISTIC_RENDER");
  if (!brief.questionStableId || !brief.briefVersion || !brief.archetype || !ARCHETYPES.has(brief.archetype) || brief.archetype === "workplace_photo") throw new Error("brief has unsupported renderer fields");
  if (!brief.visualEvidenceRequired) throw new Error("deterministic brief must require visual evidence");
  if (brief.exactTextElements.length === 0 && brief.exactDataElements.length === 0 && !["illustration", "workplace_photo", "workplace_interaction", "meeting", "office_environment", "object_scene"].includes(brief.archetype)) throw new Error("deterministic brief has no exact content");
}

function contentLines(brief: BjtQuestionImageBrief): string[] {
  return [...new Set([...brief.exactTextElements, ...brief.exactDataElements].map((value) => value.trim()).filter(Boolean))];
}

function wrap(value: string, width = 54): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += width) chunks.push(value.slice(i, i + width));
  return chunks.length ? chunks : [""];
}

function renderBody(brief: BjtQuestionImageBrief, lines: string[]): string {
  const kind = brief.archetype!;
  if (["table", "chart", "schedule"].includes(kind)) {
    const rowHeight = 64;
    const rows = lines.map((line, index) => `<rect x="100" y="${190 + index * rowHeight}" width="1400" height="${rowHeight}" fill="${index % 2 ? "#f3f6f8" : "#fff"}" stroke="#b7c4ce"/><text x="130" y="${232 + index * rowHeight}" class="body">${escapeXml(line)}</text>`).join("");
    return `<rect x="100" y="150" width="1400" height="${Math.max(64, lines.length * rowHeight)}" fill="#fff" stroke="#7f92a1" stroke-width="3"/>${rows}`;
  }
  if (["diagram", "map_layout"].includes(kind)) {
    return lines.map((line, index) => `<rect x="120" y="${190 + index * 110}" width="1360" height="76" rx="10" fill="#eef4f7" stroke="#6f8798" stroke-width="3"/><text x="155" y="${240 + index * 110}" class="body">${escapeXml(line)}</text>`).join("");
  }
  return lines.flatMap((line) => wrap(line)).map((line, index) => `<text x="120" y="${220 + index * 62}" class="body">${escapeXml(line)}</text>`).join("");
}

export function hashImageBrief(brief: BjtQuestionImageBrief): string {
  return createHash("sha256").update(JSON.stringify(brief)).digest("hex");
}

export function renderDeterministicSvg(brief: BjtQuestionImageBrief): DeterministicRenderResult {
  assertBrief(brief);
  const briefHashSha256 = hashImageBrief(brief);
  const lines = contentLines(brief);
  const title = `${brief.archetype!.replace("_", " ")} · ${brief.level}`;
  const body = renderBody(brief, lines);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><style>.title{font:700 42px Arial,"Noto Sans JP",sans-serif;fill:#17324d}.body{font:400 30px Arial,"Noto Sans JP",sans-serif;fill:#152536}.meta{font:400 20px Arial,"Noto Sans JP",sans-serif;fill:#617386}</style><rect width="100%" height="100%" fill="#f7f8fa"/><rect x="48" y="48" width="1504" height="804" rx="18" fill="#fff" stroke="#c8d2dc" stroke-width="3"/><text x="120" y="130" class="title">${escapeXml(title)}</text>${body}<text x="120" y="800" class="meta">KotobaWorks · deterministic stimulus · ${escapeXml(brief.briefVersion)}</text></svg>`;
  const outputChecksumSha256 = createHash("sha256").update(svg).digest("hex");
  return { rendererType: brief.archetype!, rendererVersion: DETERMINISTIC_RENDERER_VERSION, briefHashSha256, outputChecksumSha256, width: WIDTH, height: HEIGHT, contentId: brief.questionStableId, generatedPath: `generated/bjt/${brief.questionStableId.replace(/[^a-zA-Z0-9._-]+/gu, "_")}-${briefHashSha256.slice(0, 12)}.svg`, svg };
}

export function deterministicRenderProvenance(result: DeterministicRenderResult): DeterministicRenderProvenance {
  const { svg: _svg, ...provenance } = result;
  return provenance;
}

export async function writeDeterministicRender(result: DeterministicRenderResult, root = process.cwd()): Promise<string> {
  const path = resolve(root, result.generatedPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, result.svg, "utf8");
  return path;
}

export async function isDeterministicRenderCurrent(result: DeterministicRenderResult, root = process.cwd()): Promise<boolean> {
  try {
    const svg = await readFile(resolve(root, result.generatedPath), "utf8");
    return createHash("sha256").update(svg).digest("hex") === result.outputChecksumSha256;
  } catch {
    return false;
  }
}
