import { describe, expect, it } from "vitest";

import {
  BJT_AI_IMAGE_LICENSE,
  buildBjtAiImageMetadata,
  buildBjtImageGenerationPrompt,
  buildMinioPublicBaseUrl,
  imageMetadataForProductionSync,
  resolveBjtImageMediaHint,
  validateBjtQuestionImageMetadata
} from "./bjt-question-image-metadata.js";

describe("BJT question image metadata", () => {
  it("builds the canonical public MinIO URL from environment values", () => {
    expect(
      buildMinioPublicBaseUrl({
        endPoint: "127.0.0.1",
        port: 19000,
        useSSL: false
      })
    ).toBe("http://127.0.0.1:19000");
  });

  it("builds generation input from imagePrompt", () => {
    const prompt = buildBjtImageGenerationPrompt(
      "photo",
      "Two colleagues compare a delivery schedule beside a loading dock."
    );

    expect(prompt).toContain("Two colleagues compare a delivery schedule beside a loading dock.");
    expect(prompt).toContain("Authoritative scene brief");
  });

  it("refuses to generate without a dedicated imagePrompt", () => {
    expect(() => buildBjtImageGenerationPrompt("photo", "   ")).toThrow(
      "requires a non-empty imagePrompt"
    );
    expect(() => buildBjtImageGenerationPrompt("photo", null)).toThrow(
      "requires a non-empty imagePrompt"
    );
  });

  it("uses official-mock stimulusKind when legacy mediaHint is absent", () => {
    expect(resolveBjtImageMediaHint({ stimulusKind: "document" })).toBe("document");
    expect(
      resolveBjtImageMediaHint({
        mediaHint: "illustration",
        stimulusKind: "document"
      })
    ).toBe("illustration");
  });

  it("reports missing learner alt text and generation prompts separately", () => {
    const result = validateBjtQuestionImageMetadata([
      { id: "valid", imageAlt: "Hai đồng nghiệp", imagePrompt: "Office scene" },
      { id: "no-alt", imageAlt: null, imagePrompt: "Reception scene" },
      { id: "no-prompt", imageAlt: "Biểu đồ doanh số", imagePrompt: " " }
    ]);

    expect(result.valid.map(({ id }) => id)).toEqual(["valid"]);
    expect(result.missingAlt.map(({ id }) => id)).toEqual(["no-alt"]);
    expect(result.missingPrompt.map(({ id }) => id)).toEqual(["no-prompt"]);
  });

  it("preserves imageAlt and imagePrompt independently during production sync", () => {
    expect(
      imageMetadataForProductionSync({
        imageAlt: "Mô tả ngắn cho người học",
        imagePrompt: "Detailed production prompt with composition and lighting"
      })
    ).toEqual({
      imageAlt: "Mô tả ngắn cho người học",
      imagePrompt: "Detailed production prompt with composition and lighting"
    });
  });

  it("records AI provenance, rights, object key, and prompt hash", () => {
    expect(
      buildBjtAiImageMetadata({
        generatedAt: "2026-07-26T12:00:00.000Z",
        mediaAssetId: "asset-id",
        model: "gpt-image-1",
        objectKey: "bjt/ai/J2/reading/question.png",
        promptHashSha256: "a".repeat(64)
      })
    ).toEqual({
      generatedAt: "2026-07-26T12:00:00.000Z",
      license: BJT_AI_IMAGE_LICENSE,
      mediaAssetId: "asset-id",
      model: "gpt-image-1",
      objectKey: "bjt/ai/J2/reading/question.png",
      promptHashSha256: "a".repeat(64),
      provider: "openai",
      rightsStatus: "cleared"
    });
  });
});
