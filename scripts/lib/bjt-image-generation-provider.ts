export type BjtImageProvider = "omniroute" | "openai" | "pollinations" | "xkiro";

export interface BjtGeneratedImage {
  buffer: Buffer;
  extension: "jpeg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export interface BjtImageGeneratorConfig {
  apiKey: string | null;
  baseUrl: string;
  concurrency: number;
  height: number;
  maxAttempts: number;
  maxBytes: number;
  model: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  provider: BjtImageProvider;
  retryDelayMs: number;
  style: string | null;
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

/** Handle for an asynchronous provider-side image job (xKiro-style APIs). */
export interface BjtImageJobHandle {
  id: string;
  provider: BjtImageProvider;
}

export type BjtImageJobStatus =
  | "processing"
  | "succeeded"
  | "failed"
  | "blocked"
  | "cancelled"
  | (string & {});

export interface BjtImageJobSnapshot {
  errorMessage: string | null;
  id: string;
  imageUrl: string | null;
  status: BjtImageJobStatus;
}

type FetchImplementation = typeof fetch;

export interface BjtImageRequestOptions {
  fetchImplementation?: FetchImplementation;
  now?: () => number;
  onJobCreated?: (job: BjtImageJobHandle) => void | Promise<void>;
  onPoll?: (snapshot: BjtImageJobSnapshot) => void;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  sleep?: (milliseconds: number) => Promise<void>;
}

const POLLINATIONS_IMAGE_BASE_URL = "https://image.pollinations.ai";
const XKIRO_IMAGE_BASE_URL = "https://api.xkiro.com/v1";

/**
 * Providers whose image endpoint is an asynchronous job queue: the create call
 * returns a job id (HTTP 202) and the bytes only exist once the job succeeds.
 * Everything else answers with the image inline on a single request.
 */
const ASYNC_JOB_PROVIDERS = new Set<BjtImageProvider>(["xkiro"]);

const ALLOWED_MIME_TYPES = new Map<
  string,
  { extension: BjtGeneratedImage["extension"]; mimeType: BjtGeneratedImage["mimeType"] }
>([
  ["image/jpeg", { extension: "jpeg", mimeType: "image/jpeg" }],
  ["image/png", { extension: "png", mimeType: "image/png" }],
  ["image/webp", { extension: "webp", mimeType: "image/webp" }]
]);

export function providerUsesAsyncImageJobs(provider: BjtImageProvider): boolean {
  return ASYNC_JOB_PROVIDERS.has(provider);
}

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

/**
 * Resolve the provider credential without leaking a key across vendors: an
 * OpenAI key must never be sent to xKiro, and vice versa.
 */
function resolveApiKey(
  provider: BjtImageProvider,
  environment: Readonly<Record<string, string | undefined>>
): string | null {
  const explicit = environment.IMAGE_API_KEY?.trim();
  if (explicit) return explicit;
  if (provider === "xkiro") return environment.XKIRO_API_KEY?.trim() || null;
  if (provider === "openai" || provider === "omniroute") {
    return environment.OPENAI_API_KEY?.trim() || null;
  }
  return null;
}

export function parseBjtImageGeneratorConfig(
  environment: Readonly<Record<string, string | undefined>>,
  options: { requireCredentials?: boolean } = {}
): BjtImageGeneratorConfig {
  const rawProvider = environment.IMAGE_PROVIDER?.trim().toLowerCase() ?? "openai";
  if (!["omniroute", "openai", "pollinations", "xkiro"].includes(rawProvider)) {
    throw new Error("IMAGE_PROVIDER must be one of: omniroute, openai, pollinations, xkiro");
  }
  const provider = rawProvider as BjtImageProvider;
  const apiKey = resolveApiKey(provider, environment);

  if (options.requireCredentials !== false && provider === "openai" && !apiKey) {
    throw new Error("IMAGE_API_KEY or OPENAI_API_KEY is required for IMAGE_PROVIDER=openai");
  }
  if (options.requireCredentials !== false && provider === "xkiro" && !apiKey) {
    throw new Error("IMAGE_API_KEY or XKIRO_API_KEY is required for IMAGE_PROVIDER=xkiro");
  }

  const defaultBaseUrl =
    provider === "omniroute"
      ? "http://localhost:20128/v1"
      : provider === "pollinations"
        ? POLLINATIONS_IMAGE_BASE_URL
        : provider === "xkiro"
          ? XKIRO_IMAGE_BASE_URL
          : "https://api.openai.com/v1";
  const defaultModel =
    provider === "pollinations"
      ? "klein"
      : provider === "omniroute"
        ? "pollinations/flux"
        : provider === "xkiro"
          ? "gpt-image"
          : "gpt-image-1";
  const defaultHeight = provider === "pollinations" ? 720 : 1024;
  const defaultWidth = provider === "pollinations" ? 1280 : 1024;
  // Async job providers accept several jobs in flight, so a small pool keeps a
  // multi-hundred-image batch inside a sane wall clock. Inline providers stay
  // strictly sequential to respect their per-request rate limits.
  // xKiro demonstrated HTTP 429 at four in-flight submissions; keep the
  // default conservative while allowing operators to raise it explicitly.
  const defaultConcurrency = providerUsesAsyncImageJobs(provider) ? 2 : 1;

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(environment.IMAGE_API_BASE_URL?.trim() || defaultBaseUrl),
    concurrency: parseInteger(
      environment.IMAGE_CONCURRENCY,
      defaultConcurrency,
      1,
      16,
      "IMAGE_CONCURRENCY"
    ),
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
    pollIntervalMs: parseInteger(
      environment.IMAGE_POLL_INTERVAL_MS,
      5_000,
      1_000,
      60_000,
      "IMAGE_POLL_INTERVAL_MS"
    ),
    pollTimeoutMs: parseInteger(
      environment.IMAGE_POLL_TIMEOUT_MS,
      600_000,
      10_000,
      1_800_000,
      "IMAGE_POLL_TIMEOUT_MS"
    ),
    provider,
    retryDelayMs: parseInteger(
      environment.IMAGE_RETRY_DELAY_MS,
      5_000,
      0,
      300_000,
      "IMAGE_RETRY_DELAY_MS"
    ),
    style: environment.IMAGE_STYLE?.trim() || null,
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

/**
 * A provider refusal (`blocked`) is billable and deterministic, so it must never
 * be retried. Everything transient — timeouts, throttling, gateway errors and a
 * non-billable `failed` job — is safe to attempt again.
 */
function retryable(error: unknown): boolean {
  const flags = error as { blocked?: boolean; retryable?: boolean; status?: number } | null;
  if (flags?.blocked === true) return false;
  if (flags?.retryable === true) return true;
  if (error instanceof DOMException && error.name === "TimeoutError") return true;
  const status = flags?.status;
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export function isBlockedImageError(error: unknown): boolean {
  return (error as { blocked?: boolean } | null)?.blocked === true;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function authorizedJsonHeaders(config: BjtImageGeneratorConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  return headers;
}

async function readJobPayload(response: Response, action: string): Promise<Record<string, unknown>> {
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw Object.assign(new Error(`xKiro ${action} failed (${response.status}): ${detail || "no detail"}`), {
      status: response.status
    });
  }
  const payload = (await response.json()) as unknown;
  if (payload === null || typeof payload !== "object") {
    throw new Error(`xKiro ${action} returned a non-object payload`);
  }
  return payload as Record<string, unknown>;
}

/**
 * Submit one asynchronous image job and return its handle. Kept separate from
 * polling so callers can checkpoint the job id before waiting — a crash then
 * resumes the existing job instead of paying for a second one.
 */
export async function createBjtImageJob(
  prompt: string,
  config: BjtImageGeneratorConfig,
  options: BjtImageRequestOptions = {}
): Promise<BjtImageJobHandle> {
  if (!providerUsesAsyncImageJobs(config.provider)) {
    throw new Error(`Provider ${config.provider} has no asynchronous image job API`);
  }
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation(`${config.baseUrl}/images/generations`, {
    body: JSON.stringify({
      model: config.model,
      n: 1,
      prompt,
      size: `${config.width}x${config.height}`,
      ...(config.style ? { style: config.style } : {})
    }),
    headers: authorizedJsonHeaders(config),
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(config.timeoutMs)
  });

  const payload = await readJobPayload(response, "image job creation");
  const id = payload.id;
  if (typeof id !== "string" || id.trim() === "") {
    throw new Error("xKiro image job creation did not return a job id");
  }
  return { id: id.trim(), provider: config.provider };
}

export async function fetchBjtImageJob(
  jobId: string,
  config: BjtImageGeneratorConfig,
  options: BjtImageRequestOptions = {}
): Promise<BjtImageJobSnapshot> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation(
    `${config.baseUrl}/images/generations/${encodeURIComponent(jobId)}`,
    {
      headers: authorizedJsonHeaders(config),
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(config.timeoutMs)
    }
  );

  const payload = await readJobPayload(response, `image job lookup ${jobId}`);
  const data = Array.isArray(payload.data) ? (payload.data as Array<Record<string, unknown>>) : [];
  const firstUrl = data[0]?.url;
  const error = (payload.error ?? null) as { message?: unknown } | null;

  return {
    errorMessage: typeof error?.message === "string" ? error.message : null,
    id: typeof payload.id === "string" ? payload.id : jobId,
    imageUrl: typeof firstUrl === "string" && firstUrl.trim() !== "" ? firstUrl.trim() : null,
    status: typeof payload.status === "string" ? payload.status : "processing"
  };
}

/**
 * Download finished bytes from the provider CDN. The URL is only ever taken
 * from an authenticated job response, and must still be https with an image
 * content type inside the configured byte ceiling.
 */
export async function downloadBjtGeneratedImage(
  imageUrl: string,
  config: BjtImageGeneratorConfig,
  options: BjtImageRequestOptions = {}
): Promise<BjtGeneratedImage> {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error(`Generated image URL is not a valid URL: ${imageUrl.slice(0, 120)}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`Generated image URL must use https: ${parsed.protocol}//…`);
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation(parsed.toString(), {
    headers: { Accept: "image/png,image/jpeg,image/webp" },
    redirect: "follow",
    signal: AbortSignal.timeout(config.timeoutMs)
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Generated image download failed: ${response.status}`), {
      status: response.status
    });
  }
  return readBoundedImage(response, config.maxBytes);
}

/**
 * Poll an existing job to a terminal state and return its bytes. Resumable:
 * pass a job id recovered from a checkpoint to keep an in-flight job.
 */
export async function resolveBjtImageJob(
  jobId: string,
  config: BjtImageGeneratorConfig,
  options: BjtImageRequestOptions = {}
): Promise<BjtGeneratedImage> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => Date.now());
  const deadline = now() + config.pollTimeoutMs;

  for (;;) {
    const snapshot = await fetchBjtImageJob(jobId, config, options);

    if (snapshot.status === "succeeded") {
      if (!snapshot.imageUrl) {
        throw new Error(`xKiro job ${jobId} succeeded without an image URL`);
      }
      return downloadBjtGeneratedImage(snapshot.imageUrl, config, options);
    }
    if (snapshot.status === "blocked") {
      throw Object.assign(
        new Error(
          `xKiro job ${jobId} was blocked by the provider: ${snapshot.errorMessage ?? "content refused"}`
        ),
        { blocked: true }
      );
    }
    if (snapshot.status === "failed" || snapshot.status === "cancelled") {
      // Not billed by xKiro, so a fresh job is the cheapest recovery.
      throw Object.assign(
        new Error(`xKiro job ${jobId} ${snapshot.status}: ${snapshot.errorMessage ?? "no detail"}`),
        { retryable: true }
      );
    }

    options.onPoll?.(snapshot);
    if (now() >= deadline) {
      throw new Error(
        `xKiro job ${jobId} did not finish within ${config.pollTimeoutMs}ms (last status: ${snapshot.status})`
      );
    }
    await sleep(config.pollIntervalMs);
  }
}

async function fetchOnce(
  prompt: string,
  config: BjtImageGeneratorConfig,
  options: BjtImageRequestOptions
): Promise<BjtGeneratedImage> {
  if (config.provider === "pollinations") {
    const fetchImplementation = options.fetchImplementation ?? fetch;
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

  if (providerUsesAsyncImageJobs(config.provider)) {
    const job = await createBjtImageJob(prompt, config, options);
    await options.onJobCreated?.(job);
    return resolveBjtImageJob(job.id, config, options);
  }

  const fetchImplementation = options.fetchImplementation ?? fetch;
  const response = await fetchImplementation(`${config.baseUrl}/images/generations`, {
    body: JSON.stringify({
      model: config.model,
      n: 1,
      prompt,
      response_format: "b64_json",
      size: `${config.width}x${config.height}`
    }),
    headers: authorizedJsonHeaders(config),
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
  options: BjtImageRequestOptions = {}
): Promise<BjtGeneratedImage> {
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    try {
      return await fetchOnce(prompt, config, options);
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
  const sleep = options.sleep ?? defaultSleep;

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
