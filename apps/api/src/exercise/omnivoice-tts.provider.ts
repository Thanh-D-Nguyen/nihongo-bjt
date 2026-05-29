import { Logger } from "@nestjs/common";

import type { TtsOptions, TtsProvider, TtsResult } from "./tts.service.js";

/**
 * OmniVoice TTS provider — local self-hosted server.
 *
 * Uses the OmniVoice (k2-fsa/OmniVoice) model running locally via
 * `omnivoice-demo --ip 0.0.0.0 --port 8001` or a custom HTTP wrapper.
 *
 * Configured via environment variables:
 * - OMNIVOICE_URL             — Server URL (default: http://localhost:8001)
 * - OMNIVOICE_REF_AUDIO       — Path to reference audio for voice cloning
 * - OMNIVOICE_REF_TEXT        — Transcript of reference audio (optional)
 * - OMNIVOICE_NUM_STEPS       — Diffusion steps (default: 32)
 *
 * Key advantages over Azure TTS:
 * - Free (no per-request cost)
 * - Higher quality Japanese speech with voice cloning
 * - Full control over model and voice characteristics
 * - 600+ languages supported
 *
 * Trade-offs:
 * - Requires GPU server (local or dedicated)
 * - Higher latency per request vs Azure (~2-5s vs ~500ms)
 * - Not suitable for real-time interactive TTS — use for batch/pre-generation
 */
export class OmniVoiceTtsProvider implements TtsProvider {
  readonly name = "omnivoice";
  private readonly logger = new Logger(OmniVoiceTtsProvider.name);

  constructor(
    private readonly serverUrl: string,
    private readonly refAudioPath?: string,
    private readonly refText?: string,
    private readonly numSteps: number = 32,
  ) {}

  async synthesize(text: string, options?: TtsOptions): Promise<TtsResult> {
    const buf = await this.synthesizeBuffer(text, options);
    const base64 = buf.toString("base64");
    return {
      audioUrl: `data:audio/wav;base64,${base64}`,
      provider: this.name,
    };
  }

  async synthesizeBuffer(text: string, options?: TtsOptions): Promise<Buffer> {
    const speed = options?.speakingRate ?? 1.0;

    // Call OmniVoice Gradio API
    const payload: Record<string, unknown> = {
      data: [
        text,
        this.refAudioPath ?? "",
        this.refText ?? "",
        "",                // instruct (voice design — unused for clone mode)
        this.numSteps,
        speed,
      ],
      fn_index: 0,
    };

    const response = await fetch(`${this.serverUrl}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      this.logger.warn(
        `OmniVoice API error: ${response.status} — ${detail.slice(0, 200)}`,
      );
      throw new Error(`OmniVoice HTTP ${response.status}`);
    }

    const result = (await response.json()) as { data: string[] };
    const audioPath = result.data?.[0];

    if (!audioPath) {
      throw new Error("OmniVoice returned empty response");
    }

    // Fetch the audio file from the Gradio server
    let audioUrl: string;
    if (audioPath.startsWith("http")) {
      audioUrl = audioPath;
    } else {
      audioUrl = `${this.serverUrl}/file=${audioPath}`;
    }

    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch OmniVoice audio: ${audioRes.status}`);
    }

    return Buffer.from(await audioRes.arrayBuffer());
  }
}
