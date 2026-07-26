import { describe, expect, it, vi } from "vitest";

import {
  buildPollinationsImageUrl,
  generateBjtImage,
  parseBjtImageGeneratorConfig,
  parseBjtPromptTranslatorConfig,
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
