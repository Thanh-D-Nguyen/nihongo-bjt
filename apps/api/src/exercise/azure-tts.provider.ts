import { Logger } from "@nestjs/common";

import type { TtsOptions, TtsProvider, TtsResult } from "./tts.service.js";

/**
 * Azure Cognitive Services TTS provider.
 *
 * Configured via environment variables:
 * - AZURE_SPEECH_KEY       — primary key from the Azure Speech resource
 * - AZURE_SPEECH_REGION    — e.g. "eastasia", "japaneast", "southeastasia"
 * - AZURE_SPEECH_DEFAULT_VOICE — optional default, defaults to ja-JP-NanamiNeural
 *
 * Returns raw audio bytes as a Buffer that callers (typically a service that
 * also has access to MediaService) upload to object storage and link via the
 * MediaAsset / LexemeAudio tables.
 *
 * Output format is MP3 16kHz mono — small, browser-friendly, broadly cached.
 */
export class AzureTtsProvider implements TtsProvider {
  readonly name = "azure";
  private readonly logger = new Logger(AzureTtsProvider.name);

  constructor(
    private readonly key: string,
    private readonly region: string,
    private readonly defaultVoice: string = "ja-JP-NanamiNeural",
  ) {
    if (!key || !region) {
      throw new Error(
        "AzureTtsProvider requires AZURE_SPEECH_KEY + AZURE_SPEECH_REGION",
      );
    }
  }

  /**
   * Synthesize via Azure REST API. Returns the audio bytes inline (as a
   * data URI) for now; production callers should pass the buffer through
   * `synthesizeBuffer()` instead and upload to MediaAsset.
   */
  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    const buf = await this.synthesizeBuffer(text, options);
    const base64 = buf.toString("base64");
    return {
      audioUrl: `data:audio/mpeg;base64,${base64}`,
      provider: this.name,
    };
  }

  /**
   * Lower-level call that returns the raw audio buffer. Use this from
   * services that need to upload to object storage rather than embed inline.
   */
  async synthesizeBuffer(text: string, options?: TtsOptions): Promise<Buffer> {
    const voice = options?.voiceName ?? this.defaultVoice;
    const rate = options?.speakingRate ?? 1.0;
    const lang = options?.languageCode ?? "ja-JP";

    const ssml = this.buildSsml(text, voice, rate, lang);

    const endpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
        "User-Agent": "nihongo-bjt-tts",
      },
      body: ssml,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      this.logger.warn(
        `Azure TTS failed: ${res.status} ${res.statusText} — ${detail.slice(0, 200)}`,
      );
      throw new Error(`Azure TTS HTTP ${res.status}`);
    }

    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  /** Build a minimal SSML envelope. Escapes the text for XML safety. */
  private buildSsml(
    text: string,
    voice: string,
    rate: number,
    lang: string,
  ): string {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    // SSML rate spec: relative or absolute. Use percent for safety.
    const ratePercent = `${Math.round((rate - 1) * 100)}%`;

    return [
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">`,
      `  <voice name="${voice}">`,
      `    <prosody rate="${ratePercent}">${escaped}</prosody>`,
      `  </voice>`,
      `</speak>`,
    ].join("");
  }
}
