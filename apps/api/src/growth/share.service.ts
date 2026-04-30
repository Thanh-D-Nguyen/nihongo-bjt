import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";
import { shareCreateSchema } from "@nihongo-bjt/shared";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Client } from "minio";
import { randomBytes } from "node:crypto";

import type { z } from "zod";

import { ShareImageRenderer } from "./share-image.renderer.js";

type CreateShare = z.infer<typeof shareCreateSchema>;

@Injectable()
export class ShareService {
  private readonly prisma: PrismaClient = createPrismaClient();
  private readonly env = parseServerEnv(process.env);
  private readonly minio: Client;
  private readonly renderer = new ShareImageRenderer();

  constructor() {
    this.minio = new Client({
      accessKey: this.env.MINIO_ACCESS_KEY,
      endPoint: this.env.MINIO_ENDPOINT,
      port: this.env.MINIO_PORT,
      secretKey: this.env.MINIO_SECRET_KEY,
      useSSL: this.env.MINIO_USE_SSL
    });
  }

  async createForUser(body: unknown) {
    const parsed = shareCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const data = parsed.data;
    const template = await this.prisma.shareTemplate.findFirst({
      where: { active: true, kind: data.kind }
    });
    if (!template) {
      throw new BadRequestException("No active share template for this kind");
    }
    const user = await this.prisma.userProfile.findFirst({
      select: { id: true, sharePostcardOptIn: true },
      where: { id: data.userId, status: "active" }
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (!user.sharePostcardOptIn) {
      throw new BadRequestException({
        code: "share_opt_in_required",
        message: "Enable privacy share consent before creating public postcards."
      });
    }
    const summaryPayload = this.toSafeSummary(data);
    const publicToken = randomBytes(18).toString("base64url");
    const share = await this.prisma.shareItem.create({
      data: {
        kind: data.kind,
        publicToken,
        summaryPayload: summaryPayload as import("@nihongo-bjt/database").Prisma.InputJsonValue,
        templateId: template.id,
        userId: data.userId
      }
    });
    const { headline, sub } = this.titlesForKind(data, summaryPayload as Record<string, unknown>);
    const config = (template.config ?? {}) as Record<string, unknown>;
    const png = await this.renderer.renderPng({
      config,
      headline,
      kind: data.kind,
      sub
    });
    const objectKey = `shares/${share.id}.png`;
    const bucket = this.env.MINIO_BUCKET;
    await this.ensureBucket();
    await this.minio.putObject(bucket, objectKey, png, png.length, { "Content-Type": "image/png" });
    await this.prisma.shareCardAsset.create({
      data: {
        height: 630,
        mimeType: "image/png",
        objectKey,
        shareItemId: share.id,
        width: 1200
      }
    });
    const web = this.env.WEB_PUBLIC_URL.replace(/\/$/, "");
    return {
      imagePath: objectKey,
      publicToken: share.publicToken,
      shareUrl: `${web}/vi/share/${encodeURIComponent(share.publicToken)}`
    };
  }

  toSafeSummary(data: CreateShare) {
    switch (data.kind) {
      case "streak": {
        return { streakDays: data.payload.streakDays };
      }
      case "bjt_result": {
        return {
          band: data.payload.band,
          ...(data.payload.includeScorePercent !== true || data.payload.scorePercent === undefined
            ? {}
            : { scorePercent: data.payload.scorePercent })
        };
      }
      case "daily_phrase": {
        return { phraseLabel: data.payload.phraseLabel };
      }
      case "battle": {
        return {
          result: data.payload.result,
          ...(data.payload.band ? { band: data.payload.band } : {}),
          ...(data.payload.scorePercent !== undefined ? { scorePercent: data.payload.scorePercent } : {}),
          ...(data.payload.opponentName ? { opponentName: data.payload.opponentName } : {})
        };
      }
    }
  }

  titlesForKind(data: CreateShare, p: Record<string, unknown>): { headline: string; sub: string } {
    if (data.kind === "streak") {
      const d = p.streakDays as number;
      return { headline: `${d} day streak`, sub: "Learning habit" };
    }
    if (data.kind === "bjt_result") {
      return { headline: `BJT ${p.band as string}`, sub: "Practice result" };
    }
    if (data.kind === "battle") {
      const result = (p.result as string)?.toUpperCase() ?? "Battle";
      return { headline: `${result}`, sub: "Battle result" };
    }
    return { headline: (p.phraseLabel as string) ?? "Daily", sub: "Japanese in daily life" };
  }

  async getPublicSnapshot(token: string) {
    const item = await this.prisma.shareItem.findFirst({
      include: { cardAssets: true, template: true },
      where: { publicToken: token }
    });
    if (!item) {
      return null;
    }
    if (item.expiresAt && item.expiresAt < new Date()) {
      return null;
    }
    const asset = item.cardAssets[0] ?? null;
    const p = (item.summaryPayload ?? {}) as Record<string, unknown>;
    const title = publicTitle(item.kind, p);
    return {
      asset,
      kind: item.kind,
      summary: p,
      title
    };
  }

  private async ensureBucket() {
    const bucket = this.env.MINIO_BUCKET;
    if (!(await this.minio.bucketExists(bucket))) {
      await this.minio.makeBucket(bucket, "us-east-1");
    }
  }

  async getImageBufferForToken(token: string) {
    const item = await this.getPublicSnapshot(token);
    if (!item || !item.asset) {
      return null;
    }
    const stream = await this.minio.getObject(this.env.MINIO_BUCKET, item.asset.objectKey);
    const chunks: Buffer[] = [];
    for await (const c of stream) {
      chunks.push(c as Buffer);
    }
    return { buffer: Buffer.concat(chunks), mimeType: item.asset.mimeType };
  }
}

function publicTitle(kind: string, p: Record<string, unknown>) {
  if (kind === "streak") {
    return `${p.streakDays} day streak · NihonGo BJT`;
  }
  if (kind === "bjt_result") {
    return `BJT ${p.band} · NihonGo BJT`;
  }
  if (kind === "battle") {
    const result = (p.result as string)?.toUpperCase() ?? "Battle";
    return `${result} · NihonGo BJT`;
  }
  return "NihonGo BJT";
}
