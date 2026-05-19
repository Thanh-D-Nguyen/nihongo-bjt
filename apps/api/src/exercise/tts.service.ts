import { Injectable, Logger } from "@nestjs/common";

/**
 * TTS (Text-to-Speech) provider interface.
 * Abstraction for generating audio from Japanese text.
 * Can be backed by:
 *  - Web Speech API (browser-only, used in frontend fallback)
 *  - Google Cloud TTS
 *  - Amazon Polly
 *  - Azure Cognitive Services
 *  - Local mock (dev mode)
 */
export interface TtsProvider {
  /** Generate audio buffer from text. Returns a URL to the stored audio file. */
  synthesize(text: string, options?: TtsOptions): Promise<TtsResult>;
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
 * In dev mode, uses BrowserTtsProvider (returns a special URL that triggers
 * Web Speech API on the client). In production, routes to cloud TTS providers.
 */
@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);
  private provider: TtsProvider;

  constructor() {
    // Default to browser-fallback provider (client-side TTS)
    this.provider = new BrowserFallbackTtsProvider();
    this.logger.log(`TTS provider initialized: ${this.provider.name}`);
  }

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    return this.provider.synthesize(text, options);
  }

  getProviderName(): string {
    return this.provider.name;
  }
}

/**
 * Browser-fallback TTS provider.
 * Instead of generating server-side audio, returns a special URL format
 * that signals the frontend to use the Web Speech API (SpeechSynthesis).
 * This works without any cloud API keys and provides decent Japanese TTS.
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
