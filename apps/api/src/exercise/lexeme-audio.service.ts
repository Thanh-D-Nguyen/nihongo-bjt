import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";

import { MediaService } from "../media/media.service.js";
import { TtsService } from "./tts.service.js";

const DEFAULT_VOICE = "ja-JP-NanamiNeural";
const DEFAULT_RATE = 1.0;

interface AudioOptions {
  voiceName?: string;
  speakingRate?: number;
}

interface ResolvedAudio {
  id: string;
  lexemeId?: string;
  sentenceId?: string;
  mediaAssetId: string;
  ttsProvider: string;
  voiceName: string;
  speakingRate: number;
  /** Object storage URL for the audio file (resolved on-demand by MediaService). */
  audioUrl: string;
  cached: boolean;
}

/**
 * Cache-or-generate audio for Lexeme + ExampleSentence content.
 *
 * Lookup flow (idempotent per (lexemeId, voiceName, speakingRate)):
 * 1. Check `LexemeAudio` / `ExampleSentenceAudio` for an existing row
 * 2. If found, return its MediaAsset's resolved URL
 * 3. If not, call TtsService.synthesizeBuffer, upload to MinIO/S3 via
 *    MediaService, insert MediaAsset + audio-link row, return new URL
 *
 * Callers must supply `actorId` (a user or system UUID) — propagated to
 * MediaService for ownership tracking. For autonomous backfills, pass a
 * dedicated "system-tts" UUID configured via env.
 */
@Injectable()
export class LexemeAudioService {
  private readonly logger = new Logger(LexemeAudioService.name);
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(TtsService) private readonly tts: TtsService,
    @Inject(MediaService) private readonly media: MediaService,
  ) {}

  /** Get or generate audio for a Lexeme (uses reading if present, else headword). */
  async ensureLexemeAudio(
    lexemeId: string,
    options: AudioOptions,
    ctx: { actorId: string },
  ): Promise<ResolvedAudio> {
    const voiceName = options.voiceName ?? DEFAULT_VOICE;
    const speakingRate = options.speakingRate ?? DEFAULT_RATE;

    const cached = await this.prisma.lexemeAudio.findUnique({
      where: {
        lexemeId_voiceName_speakingRate: { lexemeId, voiceName, speakingRate },
      },
    });
    if (cached) {
      const audioUrl = await this.resolveUrl(cached.mediaAssetId, ctx.actorId);
      return { ...cached, audioUrl, cached: true };
    }

    const lexeme = await this.prisma.lexeme.findUnique({
      where: { id: lexemeId },
      select: { headword: true, reading: true },
    });
    if (!lexeme) throw new NotFoundException("Lexeme not found");

    const text = lexeme.reading?.trim() || lexeme.headword;
    const { mediaAssetId, audioUrl } = await this.synthesizeAndStore({
      text,
      voiceName,
      speakingRate,
      fileNameHint: `lexeme-${lexemeId}`,
      actorId: ctx.actorId,
      provenance: { source: "tts", kind: "lexeme", lexemeId, text },
    });

    const row = await this.prisma.lexemeAudio.create({
      data: {
        lexemeId,
        mediaAssetId,
        ttsProvider: this.tts.getProviderName(),
        voiceName,
        speakingRate,
      },
    });

    return { ...row, audioUrl, cached: false };
  }

  /** Get or generate audio for an ExampleSentence. */
  async ensureExampleAudio(
    sentenceId: string,
    options: AudioOptions,
    ctx: { actorId: string },
  ): Promise<ResolvedAudio> {
    const voiceName = options.voiceName ?? DEFAULT_VOICE;
    const speakingRate = options.speakingRate ?? DEFAULT_RATE;

    const cached = await this.prisma.exampleSentenceAudio.findUnique({
      where: {
        sentenceId_voiceName_speakingRate: { sentenceId, voiceName, speakingRate },
      },
    });
    if (cached) {
      const audioUrl = await this.resolveUrl(cached.mediaAssetId, ctx.actorId);
      return { ...cached, audioUrl, cached: true };
    }

    const sentence = await this.prisma.exampleSentence.findUnique({
      where: { id: sentenceId },
      select: { japaneseText: true, reading: true },
    });
    if (!sentence) throw new NotFoundException("ExampleSentence not found");

    const text = sentence.reading?.trim() || sentence.japaneseText;
    const { mediaAssetId, audioUrl } = await this.synthesizeAndStore({
      text,
      voiceName,
      speakingRate,
      fileNameHint: `sentence-${sentenceId}`,
      actorId: ctx.actorId,
      provenance: { source: "tts", kind: "example_sentence", sentenceId, text },
    });

    const row = await this.prisma.exampleSentenceAudio.create({
      data: {
        sentenceId,
        mediaAssetId,
        ttsProvider: this.tts.getProviderName(),
        voiceName,
        speakingRate,
      },
    });

    return { ...row, audioUrl, cached: false };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async synthesizeAndStore(input: {
    text: string;
    voiceName: string;
    speakingRate: number;
    fileNameHint: string;
    actorId: string;
    provenance: Record<string, unknown>;
  }): Promise<{ mediaAssetId: string; audioUrl: string }> {
    if (!this.tts.supportsServerSideSynthesis()) {
      throw new Error(
        `Cannot cache audio — active TTS provider "${this.tts.getProviderName()}" ` +
          `does not support server-side synthesis. Configure TTS_PROVIDER=azure.`,
      );
    }

    const buffer = await this.tts.synthesizeBuffer(input.text, {
      voiceName: input.voiceName,
      speakingRate: input.speakingRate,
    });

    const upload = await this.media.adminDirectUpload({
      buffer,
      fileName: `${input.fileNameHint}-${input.voiceName}.mp3`,
      mimeType: "audio/mpeg",
      actorId: input.actorId,
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        objectKey: upload.objectKey,
        mimeType: "audio/mpeg",
        byteSize: buffer.length,
        provider: "minio",
        rightsStatus: "approved",
        provenance: input.provenance as unknown as object,
        ownerUserId: input.actorId,
      },
    });

    return { mediaAssetId: asset.id, audioUrl: upload.url };
  }

  /** Resolve a presigned read URL for a previously-created MediaAsset. */
  private async resolveUrl(assetId: string, actorId: string): Promise<string> {
    try {
      return await this.media.getReadUrlForAsset({ assetId, userId: actorId });
    } catch (err) {
      this.logger.warn(
        `Failed to resolve read URL for asset ${assetId}: ${String(err)}`,
      );
      return "";
    }
  }
}
