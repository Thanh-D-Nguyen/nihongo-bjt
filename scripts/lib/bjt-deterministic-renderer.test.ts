import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DETERMINISTIC_RENDERER_VERSION,
  isDeterministicRenderCurrent,
  renderDeterministicSvg,
  writeDeterministicRender,
} from "./bjt-deterministic-renderer.js";
import type { BjtQuestionImageBrief } from "./bjt-question-image-metadata.js";

const brief: BjtQuestionImageBrief = {
  questionStableId: "demo:LR_DOCUMENT:0001",
  level: "J3",
  requirement: "REQUIRED",
  generationMode: "DETERMINISTIC_RENDER",
  archetype: "table",
  pedagogicalPurpose: "exact values are tested",
  visualEvidenceRequired: true,
  scene: "売上表",
  environment: "会議室",
  participants: [],
  participantRoles: [],
  actions: [],
  composition: "front-facing",
  exactTextElements: ["売上表"],
  exactDataElements: ["4月：48百万円", "5月：54百万円"],
  forbiddenInventions: ["unstated data"],
  culturalContext: "Japanese workplace",
  businessContext: "BJT",
  accessibilityAlt: "売上表",
  briefVersion: "1.0.0",
};

describe("deterministic BJT renderer", () => {
  it("renders identical semantic output for the same brief and preserves exact Japanese/data", () => {
    const first = renderDeterministicSvg(brief);
    const second = renderDeterministicSvg(brief);
    expect(first.svg).toBe(second.svg);
    expect(first.outputChecksumSha256).toBe(second.outputChecksumSha256);
    expect(first.svg).toContain("売上表");
    expect(first.svg).toContain("4月：48百万円");
    expect(first.svg).toContain("<rect x=\"100\"");
    expect(first.rendererVersion).toBe(DETERMINISTIC_RENDERER_VERSION);
  });

  it("rejects malformed deterministic briefs", () => {
    expect(() => renderDeterministicSvg({ ...brief, exactDataElements: [], exactTextElements: [] })).toThrow("no exact content");
    expect(() => renderDeterministicSvg({ ...brief, generationMode: "AI_GENERATED" })).toThrow("DETERMINISTIC_RENDER");
    expect(() => renderDeterministicSvg({ ...brief, archetype: "workplace_photo" })).toThrow("unsupported renderer");
  });

  it("writes a valid SVG and detects brief-version/output invalidation", async () => {
    const root = await mkdtemp(join(tmpdir(), "bjt-renderer-"));
    const result = renderDeterministicSvg(brief);
    const path = await writeDeterministicRender(result, root);
    expect((await readFile(path, "utf8")).startsWith("<svg ")).toBe(true);
    expect(await isDeterministicRenderCurrent(result, root)).toBe(true);
    const changed = renderDeterministicSvg({ ...brief, briefVersion: "1.0.1" });
    expect(changed.briefHashSha256).not.toBe(result.briefHashSha256);
    expect(changed.generatedPath).not.toBe(result.generatedPath);
    expect(await isDeterministicRenderCurrent(changed, root)).toBe(false);
  });
});
