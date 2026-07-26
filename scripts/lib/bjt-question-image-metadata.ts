export interface BjtQuestionImageMetadata {
  id: string;
  imageAlt: string | null;
  imagePrompt: string | null;
}

export function buildBjtAiImageLicense(provider: string, model: string): string {
  return `AI-generated first-party commissioned content via ${provider} (${model})`;
}

export function buildMinioPublicBaseUrl(input: {
  endPoint: string;
  port: number;
  useSSL: boolean;
}): string {
  const protocol = input.useSSL ? "https" : "http";
  const host = input.endPoint.replace(/^https?:\/\//u, "").replace(/\/+$/u, "");
  const defaultPort = (input.useSSL && input.port === 443) || (!input.useSSL && input.port === 80);
  return `${protocol}://${host}${defaultPort ? "" : `:${input.port}`}`;
}

export function buildBjtAiImageMetadata(input: {
  generatedAt: string;
  license: string;
  mediaAssetId: string;
  model: string;
  objectKey: string;
  promptTranslationModel?: string;
  promptHashSha256: string;
  provider: string;
}) {
  return {
    generatedAt: input.generatedAt,
    license: input.license,
    mediaAssetId: input.mediaAssetId,
    model: input.model,
    objectKey: input.objectKey,
    ...(input.promptTranslationModel
      ? { promptTranslationModel: input.promptTranslationModel }
      : {}),
    promptHashSha256: input.promptHashSha256,
    provider: input.provider,
    rightsStatus: "cleared"
  } as const;
}

export interface BjtQuestionImageMetadataValidation<T extends BjtQuestionImageMetadata> {
  valid: T[];
  missingAlt: T[];
  missingPrompt: T[];
}

function nonBlank(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveBjtImageMediaHint(qualityFlags: Record<string, unknown> | null): string {
  const explicitHint = qualityFlags?.mediaHint;
  if (typeof explicitHint === "string" && explicitHint.trim().length > 0) {
    return explicitHint.trim();
  }

  const stimulusKind = qualityFlags?.stimulusKind;
  if (
    typeof stimulusKind === "string" &&
    ["photo", "illustration", "chart", "diagram", "document"].includes(stimulusKind)
  ) {
    return stimulusKind;
  }

  return "photo";
}

/**
 * Keep learner-facing alternative text and image-generation instructions as
 * separate fields. In particular, never fall back to imageAlt here: concise,
 * accessible copy is not a sufficiently precise image-generation brief.
 */
export function buildBjtImageGenerationPrompt(
  mediaHint: string,
  imagePrompt: string | null
): string {
  if (!nonBlank(imagePrompt)) {
    throw new Error("BJT image generation requires a non-empty imagePrompt");
  }

  const baseStyle =
    "No answer cues, watermarks, or third-party logos. Suitable as an accessible BJT test stimulus.";
  const prompt = imagePrompt.trim();

  switch (mediaHint) {
    case "photo":
      return [
        `Authoritative scene brief — this content must dominate the image: ${prompt}`,
        "Create a professional business photograph for a Japanese BJT question.",
        `Production constraints: photorealistic, natural observer angle, contemporary Japanese workplace, no visible or legible writing, letters, numbers, signage, screens, charts, or documents. ${baseStyle}`
      ].join("\n");
    case "illustration":
      return [
        `Authoritative scene brief — this content must dominate the image: ${prompt}`,
        "Create a clean modern illustration for a Japanese BJT question.",
        `Production constraints: restrained professional palette, clear visual hierarchy, culturally accurate Japanese workplace. ${baseStyle}`
      ].join("\n");
    case "chart":
      return [
        `Authoritative chart brief — preserve every stated value and relationship: ${prompt}`,
        "Create a professional business chart or graph for a Japanese BJT question.",
        `Production constraints: readable data relationships, accessible contrast, authentic Japanese business-report styling. ${baseStyle}`
      ].join("\n");
    case "diagram":
      return [
        `Authoritative diagram brief — preserve every stated item, position, sequence, and relationship: ${prompt}`,
        "Create a clean front-facing business diagram for a Japanese BJT question.",
        `Production constraints: precise spatial hierarchy, minimal decoration, accessible contrast, authentic Japanese workplace styling. ${baseStyle}`
      ].join("\n");
    case "document":
      return [
        `Authoritative document brief — preserve every stated field and relationship: ${prompt}`,
        "Create a Japanese business document stimulus for a BJT question.",
        `Production constraints: clean front-facing layout, readable hierarchy, authentic contemporary formatting. ${baseStyle}`
      ].join("\n");
    default:
      return [
        `Authoritative image brief — this content must dominate the image: ${prompt}`,
        "Create a professional image for a Japanese BJT question.",
        `Production constraints: culturally accurate contemporary Japanese business setting. ${baseStyle}`
      ].join("\n");
  }
}

export function validateBjtQuestionImageMetadata<T extends BjtQuestionImageMetadata>(
  rows: readonly T[]
): BjtQuestionImageMetadataValidation<T> {
  const valid: T[] = [];
  const missingAlt: T[] = [];
  const missingPrompt: T[] = [];

  for (const row of rows) {
    const hasAlt = nonBlank(row.imageAlt);
    const hasPrompt = nonBlank(row.imagePrompt);

    if (!hasAlt) missingAlt.push(row);
    if (!hasPrompt) missingPrompt.push(row);
    if (hasAlt && hasPrompt) valid.push(row);
  }

  return { valid, missingAlt, missingPrompt };
}

export function imageMetadataForProductionSync(
  row: Pick<BjtQuestionImageMetadata, "imageAlt" | "imagePrompt">
): Pick<BjtQuestionImageMetadata, "imageAlt" | "imagePrompt"> {
  return {
    imageAlt: row.imageAlt,
    imagePrompt: row.imagePrompt
  };
}
