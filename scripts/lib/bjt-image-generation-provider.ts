export type BjtImageProvider = "omniroute" | "openai" | "pollinations";

export interface BjtGeneratedImage {
  buffer: Buffer;
  extension: "jpeg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface BjtImageGeneratorConfig {
  apiKey: string | null;
  baseUrl: string;
  height: number;
  maxAttempts: number;
  maxBytes: number;
  model: string;
  provider: BjtImageProvider;
  retryDelayMs: number;
  timeoutMs: number;
  width: number;
}

export interface BjtPromptTranslatorConfig {
  apiKey: string | null;
  baseUrl: string;
  maxAttempts: number;
  model: string;
  retryDelayMs: number;
  timeoutMs: number;
}

type FetchImplementation = typeof fetch;

const POLLINATIONS_IMAGE_BASE_URL = "https://image.pollinations.ai";
const ALLOWED_MIME_TYPES = new Map<
  string,
  { extension: BjtGeneratedImage["extension"]; mimeType: BjtGeneratedImage["mimeType"] }
>([
  ["image/jpeg", { extension: "jpeg", mimeType: "image/jpeg" }],
  ["image/png", { extension: "png", mimeType: "image/png" }],
  ["image/webp", { extension: "webp", mimeType: "image/webp" }]
]);

function parseInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/u, "");
}

export function parseBjtImageGeneratorConfig(
  environment: Readonly<Record<string, string | undefined>>,
  options: { requireCredentials?: boolean } = {}
): BjtImageGeneratorConfig {
  const rawProvider = environment.IMAGE_PROVIDER?.trim().toLowerCase() ?? "openai";
  if (!["omniroute", "openai", "pollinations"].includes(rawProvider)) {
    throw new Error("IMAGE_PROVIDER must be one of: omniroute, openai, pollinations");
  }
  const provider = rawProvider as BjtImageProvider;
  const apiKey = environment.IMAGE_API_KEY?.trim() || environment.OPENAI_API_KEY?.trim() || null;

  if (options.requireCredentials !== false && provider === "openai" && !apiKey) {
    throw new Error("IMAGE_API_KEY or OPENAI_API_KEY is required for IMAGE_PROVIDER=openai");
  }

  const defaultBaseUrl =
    provider === "omniroute"
      ? "http://localhost:20128/v1"
      : provider === "pollinations"
        ? POLLINATIONS_IMAGE_BASE_URL
        : "https://api.openai.com/v1";
  const defaultModel =
    provider === "pollinations"
      ? "klein"
      : provider === "omniroute"
        ? "pollinations/flux"
        : "gpt-image-1";
  const defaultHeight = provider === "pollinations" ? 720 : 1024;
  const defaultWidth = provider === "pollinations" ? 1280 : 1024;

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(environment.IMAGE_API_BASE_URL?.trim() || defaultBaseUrl),
    height: parseInteger(environment.IMAGE_HEIGHT, defaultHeight, 256, 2048, "IMAGE_HEIGHT"),
    maxAttempts: parseInteger(environment.IMAGE_MAX_ATTEMPTS, 3, 1, 8, "IMAGE_MAX_ATTEMPTS"),
    maxBytes: parseInteger(
      environment.IMAGE_MAX_BYTES,
      15 * 1024 * 1024,
      1024,
      50 * 1024 * 1024,
      "IMAGE_MAX_BYTES"
    ),
    model: environment.IMAGE_MODEL?.trim() || defaultModel,
    provider,
    retryDelayMs: parseInteger(
      environment.IMAGE_RETRY_DELAY_MS,
      5_000,
      0,
      300_000,
      "IMAGE_RETRY_DELAY_MS"
    ),
    timeoutMs: parseInteger(
      environment.IMAGE_TIMEOUT_MS,
      180_000,
      1_000,
      600_000,
      "IMAGE_TIMEOUT_MS"
    ),
    width: parseInteger(environment.IMAGE_WIDTH, defaultWidth, 256, 2048, "IMAGE_WIDTH")
  };
}

export function parseBjtPromptTranslatorConfig(
  environment: Readonly<Record<string, string | undefined>>
): BjtPromptTranslatorConfig | null {
  const model = environment.IMAGE_PROMPT_TRANSLATION_MODEL?.trim();
  if (!model) return null;

  return {
    apiKey: environment.IMAGE_PROMPT_TRANSLATION_API_KEY?.trim() || null,
    baseUrl: normalizeBaseUrl(
      environment.IMAGE_PROMPT_TRANSLATION_BASE_URL?.trim() || "http://localhost:20128/v1"
    ),
    maxAttempts: parseInteger(
      environment.IMAGE_PROMPT_TRANSLATION_MAX_ATTEMPTS,
      3,
      1,
      8,
      "IMAGE_PROMPT_TRANSLATION_MAX_ATTEMPTS"
    ),
    model,
    retryDelayMs: parseInteger(
      environment.IMAGE_PROMPT_TRANSLATION_RETRY_DELAY_MS,
      2_000,
      0,
      300_000,
      "IMAGE_PROMPT_TRANSLATION_RETRY_DELAY_MS"
    ),
    timeoutMs: parseInteger(
      environment.IMAGE_PROMPT_TRANSLATION_TIMEOUT_MS,
      30_000,
      1_000,
      120_000,
      "IMAGE_PROMPT_TRANSLATION_TIMEOUT_MS"
    )
  };
}

export function buildPollinationsImageUrl(
  prompt: string,
  config: Pick<BjtImageGeneratorConfig, "baseUrl" | "height" | "model" | "width">
): string {
  const url = new URL(`/prompt/${encodeURIComponent(prompt)}`, `${config.baseUrl}/`);
  url.searchParams.set("height", String(config.height));
  url.searchParams.set("model", config.model);
  url.searchParams.set("nologo", "true");
  url.searchParams.set("private", "true");
  url.searchParams.set("width", String(config.width));
  return url.toString();
}

function imageType(contentType: string | null) {
  return ALLOWED_MIME_TYPES.get(contentType?.split(";")[0]?.trim().toLowerCase() ?? "");
}

async function readBoundedImage(response: Response, maxBytes: number): Promise<BjtGeneratedImage> {
  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Generated image exceeds ${maxBytes} bytes`);
  }

  const type = imageType(response.headers.get("content-type"));
  if (!type) {
    throw new Error(
      `Image provider returned unsupported content type: ${response.headers.get("content-type") || "unknown"}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new Error(`Generated image exceeds ${maxBytes} bytes`);
  }
  return { buffer, ...type };
}

function decodeBase64Image(value: unknown, maxBytes: number): BjtGeneratedImage {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Image provider did not return b64_json");
  }
  const buffer = Buffer.from(value, "base64");
  if (buffer.length === 0 || buffer.length > maxBytes) {
    throw new Error(`Generated image is empty or exceeds ${maxBytes} bytes`);
  }
  return { buffer, extension: "png", mimeType: "image/png" };
}

function retryable(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "TimeoutError") return true;
  const status = (error as { status?: number }).status;
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function fetchOnce(
  prompt: string,
  config: BjtImageGeneratorConfig,
  fetchImplementation: FetchImplementation
): Promise<BjtGeneratedImage> {
  if (config.provider === "pollinations") {
    const response = await fetchImplementation(buildPollinationsImageUrl(prompt, config), {
      headers: { Accept: "image/png,image/jpeg,image/webp" },
      redirect: "error",
      signal: AbortSignal.timeout(config.timeoutMs)
    });
    if (!response.ok) {
      throw Object.assign(new Error(`Pollinations image request failed: ${response.status}`), {
        status: response.status
      });
    }
    return readBoundedImage(response, config.maxBytes);
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const response = await fetchImplementation(`${config.baseUrl}/images/generations`, {
    body: JSON.stringify({
      model: config.model,
      n: 1,
      prompt,
      response_format: "b64_json",
      size: `${config.width}x${config.height}`
    }),
    headers,
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(config.timeoutMs)
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw Object.assign(
      new Error(`Image provider request failed (${response.status}): ${detail || "no detail"}`),
      { status: response.status }
    );
  }

  const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(contentLength) && contentLength > config.maxBytes * 2) {
    throw new Error(`Image provider response exceeds ${config.maxBytes * 2} bytes`);
  }

  const payload = (await response.json()) as { data?: Array<{ b64_json?: unknown }> };
  return decodeBase64Image(payload.data?.[0]?.b64_json, config.maxBytes);
}

export async function generateBjtImage(
  prompt: string,
  config: BjtImageGeneratorConfig,
  options: {
    fetchImplementation?: FetchImplementation;
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {}
): Promise<BjtGeneratedImage> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    try {
      return await fetchOnce(prompt, config, fetchImplementation);
    } catch (error) {
      if (attempt >= config.maxAttempts || !retryable(error)) throw error;
      const delayMs = config.retryDelayMs * 2 ** (attempt - 1);
      options.onRetry?.(attempt, error, delayMs);
      await sleep(delayMs);
    }
  }

  throw new Error("Image generation attempts exhausted");
}

async function translateOnce(
  sourcePrompt: string,
  config: BjtPromptTranslatorConfig,
  fetchImplementation: FetchImplementation
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const response = await fetchImplementation(`${config.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      max_tokens: 500,
      messages: [
        {
          content:
            "Translate the supplied Japanese BJT visual brief into a concise, literal English image-generation prompt. Preserve every person, business role, action, object, value, position, sequence, and relationship. Do not add answer cues. Output English only.",
          role: "system"
        },
        { content: sourcePrompt, role: "user" }
      ],
      model: config.model,
      stream: false,
      temperature: 0.1
    }),
    headers,
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(config.timeoutMs)
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw Object.assign(
      new Error(`Prompt translation failed (${response.status}): ${detail || "no detail"}`),
      { status: response.status }
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const translated = payload.choices?.[0]?.message?.content;
  if (typeof translated !== "string" || translated.trim().length < 10) {
    throw new Error("Prompt translator returned an empty or invalid response");
  }
  return translated.trim();
}

export async function translateBjtImagePrompt(
  sourcePrompt: string,
  config: BjtPromptTranslatorConfig,
  options: {
    fetchImplementation?: FetchImplementation;
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {}
): Promise<string> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const sleep =
    options.sleep ??
    ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    try {
      return await translateOnce(sourcePrompt, config, fetchImplementation);
    } catch (error) {
      if (attempt >= config.maxAttempts || !retryable(error)) throw error;
      const delayMs = config.retryDelayMs * 2 ** (attempt - 1);
      options.onRetry?.(attempt, error, delayMs);
      await sleep(delayMs);
    }
  }

  throw new Error("Prompt translation attempts exhausted");
}
