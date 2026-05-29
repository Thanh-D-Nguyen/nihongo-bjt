import { Injectable, Logger } from "@nestjs/common";

import { AzureTtsProvider } from "./azure-tts.provider.js";
import { OmniVoiceTtsProvider } from "./omnivoice-tts.provider.js";

/**
 * TTS (Text-to-Speech) provider interface.
 * Abstraction for generating audio from Japanese text.
 * Can be backed by:
 *  - Web Speech API (browser-only, used in frontend fallback)
 *  - Azure Cognitive Services (server-side, production)
 *  - Google Cloud TTS (future)
 *  - Amazon Polly (future)
 *  - Local mock (dev mode)
 */
export interface TtsProvider {
  /** Generate audio buffer from text. Returns a URL to the stored audio file. */
  synthesize(text: string, options?: TtsOptions): Promise<TtsResult>;
  /** Optional — return raw audio bytes for callers that upload to object storage themselves. */
  synthesizeBuffer?(text: string, options?: TtsOptions): Promise<Buffer>;
  /** Provider name for logging */
  readonly name: string;
}

export interface TtsOptions {
  /** ja-JP, en-US, vi-VN */
  languageCode?: string;
  /** Speed: 0.5–2.0 (1.0 = normal) */
  speakingRate?: number;
  /** Voice name if provider supports multiple */
  voiceName?: string;
  /** Audio format */
  format?: "mp3" | "ogg" | "wav";
}

export interface TtsResult {
  /** URL to the generated audio file (MinIO/S3/local) */
  audioUrl: string;
  /** Duration in milliseconds (if available) */
  durationMs?: number;
  /** Provider that generated this audio */
  provider: string;
}

/**
 * TTS Service — orchestrates text-to-speech generation.
 *
 * Provider selection (via env `TTS_PROVIDER`):
 * - `azure`   → AzureTtsProvider (requires AZURE_SPEECH_KEY + AZURE_SPEECH_REGION)
 * - `browser` → BrowserFallbackTtsProvider (default; returns a URI the client
 *               interprets via Web Speech API — no server audio bytes)
 *
 * Callers that need cached audio bytes (e.g. LexemeAudioService) should use
 * `synthesizeBuffer()` — it throws if the active provider doesn't support
 * server-side audio (browser fallback).
 */
@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private provider: TtsProvider;

  constructor() {
    this.provider = this.pickProvider();
    this.logger.log(`TTS provider initialized: ${this.provider.name}`);
  }

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    return this.provider.synthesize(text, options);
  }

  /**
   * Return raw audio bytes for the given text. Throws if the active provider
   * does not support server-side synthesis (browser fallback). Use this from
   * services that upload to object storage themselves.
   */
  async synthesizeBuffer(text: string, options?: TtsOptions): Promise<Buffer> {
    if (!this.provider.synthesizeBuffer) {
      throw new Error(
        `Active TTS provider "${this.provider.name}" does not support synthesizeBuffer. ` +
          `Set TTS_PROVIDER=azure and configure AZURE_SPEECH_KEY/REGION.`,
      );
    }
    return this.provider.synthesizeBuffer(text, options);
  }

  getProviderName(): string {
    return this.provider.name;
  }

  /** Returns true when the active provider can hand back raw audio bytes. */
  supportsServerSideSynthesis(): boolean {
    return typeof this.provider.synthesizeBuffer === "function";
  }

  private pickProvider(): TtsProvider {
    const choice = (process.env.TTS_PROVIDER ?? "browser").toLowerCase();
    if (choice === "azure") {
      const key = process.env.AZURE_SPEECH_KEY ?? "";
      const region = process.env.AZURE_SPEECH_REGION ?? "";
      const defaultVoice = process.env.AZURE_SPEECH_DEFAULT_VOICE;
      if (!key || !region) {
        this.logger.warn(
          "TTS_PROVIDER=azure but AZURE_SPEECH_KEY/REGION missing — falling back to browser",
        );
        return new BrowserFallbackTtsProvider();
      }
      return new AzureTtsProvider(key, region, defaultVoice);
    }
    if (choice === "omnivoice") {
      const url = process.env.OMNIVOICE_URL ?? "http://localhost:8001";
      const refAudio = process.env.OMNIVOICE_REF_AUDIO;
      const refText = process.env.OMNIVOICE_REF_TEXT;
      const numSteps = parseInt(process.env.OMNIVOICE_NUM_STEPS ?? "32", 10);
      return new OmniVoiceTtsProvider(url, refAudio, refText, numSteps);
    }
    return new BrowserFallbackTtsProvider();
  }
}

/**
 * Browser-fallback TTS provider.
 * Instead of generating server-side audio, returns a special URL format
 * that signals the frontend to use the Web Speech API (SpeechSynthesis).
 * This works without any cloud API keys and provides decent Japanese TTS.
 *
 * Does NOT implement `synthesizeBuffer` — server-side cache calls will fail.
 */
class BrowserFallbackTtsProvider implements TtsProvider {
  readonly name = "browser-fallback";

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    const rate = options?.speakingRate ?? 0.9;
    const lang = options?.languageCode ?? "ja-JP";

    // Encode as a special data URI that the frontend interprets
    const params = new URLSearchParams({
      text,
      lang,
      rate: String(rate)
    });

    return {
      audioUrl: `tts://speak?${params.toString()}`,
      provider: this.name
    };
  }
}
