import { describe, expect, it, vi } from "vitest";

import {
  buildPollinationsImageUrl,
  createBjtImageJob,
  fetchBjtImageJob,
  generateBjtImage,
  isBlockedImageError,
  parseBjtImageGeneratorConfig,
  parseBjtPromptTranslatorConfig,
  providerUsesAsyncImageJobs,
  resolveBjtImageJob,
  translateBjtImagePrompt
} from "./bjt-image-generation-provider.js";

describe("BJT image generation provider", () => {
  it("parses a free Pollinations configuration without an API key", () => {
    const config = parseBjtImageGeneratorConfig({
      IMAGE_HEIGHT: "720",
      IMAGE_PROVIDER: "pollinations",
      IMAGE_WIDTH: "1280"
    });

    expect(config).toMatchObject({
      apiKey: null,
      baseUrl: "https://image.pollinations.ai",
      height: 720,
      model: "klein",
      provider: "pollinations",
      width: 1280
    });
  });

  it("requires credentials for the OpenAI provider", () => {
    expect(() => parseBjtImageGeneratorConfig({ IMAGE_PROVIDER: "openai" })).toThrow(
      "IMAGE_API_KEY or OPENAI_API_KEY is required"
    );
  });

  it("builds a private, watermark-free Pollinations URL", () => {
    const url = new URL(
      buildPollinationsImageUrl("会議室 / no text", {
        baseUrl: "https://image.pollinations.ai",
        height: 720,
        model: "flux",
        width: 1280
      })
    );

    expect(decodeURIComponent(url.pathname)).toContain("会議室 / no text");
    expect(url.searchParams.get("model")).toBe("flux");
    expect(url.searchParams.get("nologo")).toBe("true");
    expect(url.searchParams.get("private")).toBe("true");
  });

  it("accepts bounded image bytes from Pollinations", async () => {
    const fetchImplementation = vi.fn(async () => {
      return new Response(Uint8Array.from([1, 2, 3]), {
        headers: { "content-type": "image/jpeg" },
        status: 200
      });
    });
    const config = parseBjtImageGeneratorConfig({
      IMAGE_MAX_ATTEMPTS: "1",
      IMAGE_PROVIDER: "pollinations"
    });

    const image = await generateBjtImage("Office scene", config, { fetchImplementation });

    expect(image).toEqual({
      buffer: Buffer.from([1, 2, 3]),
      extension: "jpeg",
      mimeType: "image/jpeg"
    });
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it("rejects oversized or non-image responses before buffering their bodies", async () => {
    const oversizedBody = {
      arrayBuffer: vi.fn(async () => Uint8Array.from([1, 2, 3]).buffer),
      headers: new Headers({
        "content-length": "99999999",
        "content-type": "image/jpeg"
      }),
      ok: true,
      status: 200
    } as unknown as Response;
    const textBody = {
      arrayBuffer: vi.fn(async () => Uint8Array.from([1, 2, 3]).buffer),
      headers: new Headers({ "content-type": "text/plain" }),
      ok: true,
      status: 200
    } as unknown as Response;
    const config = parseBjtImageGeneratorConfig({
      IMAGE_MAX_ATTEMPTS: "1",
      IMAGE_PROVIDER: "pollinations"
    });

    await expect(
      generateBjtImage("Office scene", config, {
        fetchImplementation: vi.fn(async () => oversizedBody)
      })
    ).rejects.toThrow("Generated image exceeds");
    await expect(
      generateBjtImage("Office scene", config, {
        fetchImplementation: vi.fn(async () => textBody)
      })
    ).rejects.toThrow("unsupported content type: text/plain");
    expect(oversizedBody.arrayBuffer).not.toHaveBeenCalled();
    expect(textBody.arrayBuffer).not.toHaveBeenCalled();
  });

  it("retries transient OpenAI-compatible failures and preserves b64 output", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 504 }))
      .mockResolvedValueOnce(
        Response.json({
          data: [{ b64_json: Buffer.from([4, 5, 6]).toString("base64") }]
        })
      );
    const config = parseBjtImageGeneratorConfig({
      IMAGE_MAX_ATTEMPTS: "2",
      IMAGE_PROVIDER: "omniroute",
      IMAGE_RETRY_DELAY_MS: "0"
    });

    const image = await generateBjtImage("Office scene", config, {
      fetchImplementation,
      sleep: vi.fn(async () => undefined)
    });

    expect(image.buffer).toEqual(Buffer.from([4, 5, 6]));
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("translates Japanese visual briefs through an OmniRoute text model", async () => {
    const config = parseBjtPromptTranslatorConfig({
      IMAGE_PROMPT_TRANSLATION_MODEL: "nvidia/meta/llama-3.1-8b-instruct"
    });
    const fetchImplementation = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { stream?: boolean };
      expect(body.stream).toBe(false);
      return Response.json({
        choices: [
          {
            message: {
              content: "A reserved guest asks the receptionist for a meeting with Director Tanaka."
            }
          }
        ]
      });
    });

    expect(config).not.toBeNull();
    const translated = await translateBjtImagePrompt("予約客が面談を申し出ている。", config!, {
      fetchImplementation
    });

    expect(translated).toContain("reserved guest");
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });
});

describe("xKiro asynchronous image jobs", () => {
  const xkiroEnv = {
    IMAGE_API_KEY: "xk-test",
    IMAGE_MAX_ATTEMPTS: "1",
    IMAGE_POLL_INTERVAL_MS: "1000",
    IMAGE_PROVIDER: "xkiro"
  } as const;

  it("defaults to the xKiro job endpoint with an async, concurrent profile", () => {
    const config = parseBjtImageGeneratorConfig(xkiroEnv);

    expect(config).toMatchObject({
      apiKey: "xk-test",
      baseUrl: "https://api.xkiro.com/v1",
      concurrency: 2,
      height: 1024,
      model: "gpt-image",
      provider: "xkiro",
      width: 1024
    });
    expect(providerUsesAsyncImageJobs("xkiro")).toBe(true);
    expect(providerUsesAsyncImageJobs("openai")).toBe(false);
  });

  it("requires an xKiro credential and never reuses the OpenAI key", () => {
    expect(() =>
      parseBjtImageGeneratorConfig({ IMAGE_PROVIDER: "xkiro", OPENAI_API_KEY: "sk-openai" })
    ).toThrow("IMAGE_API_KEY or XKIRO_API_KEY is required");

    expect(
      parseBjtImageGeneratorConfig({ IMAGE_PROVIDER: "xkiro", XKIRO_API_KEY: "xk-1" }).apiKey
    ).toBe("xk-1");
  });

  it("submits a bearer-authenticated job and reports its id", async () => {
    const fetchImplementation = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.xkiro.com/v1/images/generations");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer xk-test");
      const body = JSON.parse(String(init?.body)) as { n: number; size: string; model: string };
      expect(body).toMatchObject({ model: "gpt-image", n: 1, size: "1024x1024" });
      return Response.json({ id: "job-1", status: "processing" }, { status: 202 });
    });

    const job = await createBjtImageJob("Office scene", parseBjtImageGeneratorConfig(xkiroEnv), {
      fetchImplementation
    });

    expect(job).toEqual({ id: "job-1", provider: "xkiro" });
  });

  it("polls until the job succeeds, then downloads the CDN image", async () => {
    const onJobCreated = vi.fn();
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "job-2", status: "processing" }, { status: 202 }))
      .mockResolvedValueOnce(Response.json({ id: "job-2", status: "processing" }))
      .mockResolvedValueOnce(
        Response.json({
          data: [{ url: "https://cdn.xkiro.com/images/job-2.png" }],
          id: "job-2",
          status: "succeeded"
        })
      )
      .mockResolvedValueOnce(
        new Response(Uint8Array.from([7, 8, 9]), { headers: { "content-type": "image/png" } })
      );
    const sleep = vi.fn(async () => undefined);

    const image = await generateBjtImage("Office scene", parseBjtImageGeneratorConfig(xkiroEnv), {
      fetchImplementation,
      onJobCreated,
      sleep
    });

    expect(image).toMatchObject({ extension: "png", mimeType: "image/png" });
    expect(image.buffer).toEqual(Buffer.from([7, 8, 9]));
    expect(onJobCreated).toHaveBeenCalledWith({ id: "job-2", provider: "xkiro" });
    expect(String(fetchImplementation.mock.calls[1]![0])).toBe(
      "https://api.xkiro.com/v1/images/generations/job-2"
    );
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("never retries a blocked job because xKiro bills refusals", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "job-3", status: "processing" }, { status: 202 }))
      .mockResolvedValueOnce(
        Response.json({ error: { message: "content refused" }, id: "job-3", status: "blocked" })
      );
    const config = parseBjtImageGeneratorConfig({ ...xkiroEnv, IMAGE_MAX_ATTEMPTS: "3" });

    const error = await generateBjtImage("Office scene", config, {
      fetchImplementation,
      sleep: vi.fn(async () => undefined)
    }).catch((err: unknown) => err);

    expect(isBlockedImageError(error)).toBe(true);
    expect((error as Error).message).toContain("content refused");
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("retries a failed job with a fresh submission because failures are not billed", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: "job-4", status: "processing" }, { status: 202 }))
      .mockResolvedValueOnce(
        Response.json({ error: { message: "upstream hiccup" }, id: "job-4", status: "failed" })
      )
      .mockResolvedValueOnce(Response.json({ id: "job-5", status: "processing" }, { status: 202 }))
      .mockResolvedValueOnce(
        Response.json({
          data: [{ url: "https://cdn.xkiro.com/images/job-5.jpeg" }],
          id: "job-5",
          status: "succeeded"
        })
      )
      .mockResolvedValueOnce(
        new Response(Uint8Array.from([1]), { headers: { "content-type": "image/jpeg" } })
      );
    const config = parseBjtImageGeneratorConfig({
      ...xkiroEnv,
      IMAGE_MAX_ATTEMPTS: "2",
      IMAGE_RETRY_DELAY_MS: "0"
    });

    const image = await generateBjtImage("Office scene", config, {
      fetchImplementation,
      sleep: vi.fn(async () => undefined)
    });

    expect(image.extension).toBe("jpeg");
    expect(fetchImplementation).toHaveBeenCalledTimes(5);
  });

  it("gives up on a job that never leaves processing", async () => {
    const fetchImplementation = vi.fn(async () => Response.json({ id: "job-6", status: "processing" }));
    const config = parseBjtImageGeneratorConfig({
      ...xkiroEnv,
      IMAGE_POLL_TIMEOUT_MS: "10000"
    });
    let clock = 0;

    await expect(
      resolveBjtImageJob("job-6", config, {
        fetchImplementation,
        now: () => clock,
        sleep: async () => {
          clock += 6_000;
        }
      })
    ).rejects.toThrow("did not finish within 10000ms");
  });

  it("refuses a non-https generated image URL", async () => {
    const fetchImplementation = vi.fn(async () =>
      Response.json({
        data: [{ url: "http://cdn.xkiro.com/images/job-7.png" }],
        id: "job-7",
        status: "succeeded"
      })
    );

    await expect(
      resolveBjtImageJob("job-7", parseBjtImageGeneratorConfig(xkiroEnv), { fetchImplementation })
    ).rejects.toThrow("must use https");
  });

  it("surfaces a job lookup HTTP failure as retryable throttling", async () => {
    const fetchImplementation = vi.fn(async () => new Response("slow down", { status: 429 }));

    const error = await fetchBjtImageJob("job-8", parseBjtImageGeneratorConfig(xkiroEnv), {
      fetchImplementation
    }).catch((err: unknown) => err);

    expect((error as { status?: number }).status).toBe(429);
    expect((error as Error).message).toContain("image job lookup job-8 failed (429)");
  });
});
