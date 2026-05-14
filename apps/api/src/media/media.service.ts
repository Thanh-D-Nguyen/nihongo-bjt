import { parseServerEnv } from "@nihongo-bjt/config";
import { createPrismaClient } from "@nihongo-bjt/database";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Client } from "minio";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

/**
 * **Object storage** (MinIO/S3) for learner/admin uploads. Assets store **provenance/rights** in PostgreSQL
 * (`rights_status`, etc.) so we never treat hotlinked or unvetted images as final learning content.
 */
@Injectable()
export class MediaService {
  private readonly prisma = createPrismaClient();
  private readonly env = parseServerEnv(process.env);
  private readonly minio: Client;

  constructor() {
    this.minio = new Client({
      accessKey: this.env.MINIO_ACCESS_KEY,
      endPoint: this.env.MINIO_ENDPOINT,
      port: this.env.MINIO_PORT,
      secretKey: this.env.MINIO_SECRET_KEY,
      useSSL: this.env.MINIO_USE_SSL
    });
  }

  /**
   * Creates a `media_asset` row (`rights_status: pending_review`) and returns a time-limited PUT URL.
   * **Invariant:** the binary lives in object storage; DB holds metadata and license workflow only.
   */
  async presignUpload(input: { fileName: string; mimeType: string; userId: string }) {
    await this.ensureBucket();
    const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const objectKey = `${input.userId}/${randomUUID()}-${safe}`;

    const asset = await this.prisma.mediaAsset.create({
      data: {
        mimeType: input.mimeType,
        objectKey,
        ownerUserId: input.userId,
        provider: "local",
        rightsStatus: "pending_review",
        status: "active"
      }
    });

    const bucket = this.env.MINIO_BUCKET;
    const uploadUrl = await this.minio.presignedPutObject(bucket, objectKey, 60 * 60);
    return { assetId: asset.id, objectKey, uploadUrl };
  }

  async completeUpload(input: { assetId: string; byteSize: number; userId: string }) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: input.assetId, ownerUserId: input.userId, status: "active" }
    });
    if (!asset) {
      throw new NotFoundException("Media asset not found");
    }

    const bucket = this.env.MINIO_BUCKET;
    let stat: { size: number };
    try {
      stat = await this.minio.statObject(bucket, asset.objectKey);
    } catch {
      throw new BadRequestException(
        "Object not found in storage; complete upload after PUT to presigned URL"
      );
    }
    if (stat.size !== input.byteSize) {
      throw new BadRequestException("Reported size does not match stored object");
    }

    return this.prisma.mediaAsset.update({
      data: { byteSize: input.byteSize },
      where: { id: asset.id }
    });
  }

  async updateRightsMetadata(input: {
    assetId: string;
    accessibility?: {
      altText: string;
      caption?: string;
      reducedMotionSafe?: boolean;
      transcript?: string;
    };
    license: string;
    provenance?: {
      capturedAt?: string;
      creatorName?: string;
      isAiGenerated?: boolean;
      licenseEvidenceUrl?: string;
      sourceName?: string;
    };
    sourceUrl?: string;
    userId: string;
  }) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: input.assetId, ownerUserId: input.userId, status: "active" }
    });
    if (!asset) {
      throw new NotFoundException("Media asset not found");
    }

    if (asset.provider !== "local" && !input.sourceUrl) {
      throw new BadRequestException("sourceUrl is required for non-local media providers");
    }

    if (asset.mimeType.startsWith("image/") && !input.accessibility?.altText) {
      throw new BadRequestException("accessibility.altText is required for image media");
    }

    if (asset.mimeType === "image/gif" && input.accessibility?.reducedMotionSafe !== true) {
      throw new BadRequestException(
        "accessibility.reducedMotionSafe must be true for animated GIF media"
      );
    }

    return this.prisma.mediaAsset.update({
      data: {
        accessibility: input.accessibility,
        license: input.license,
        provenance: input.provenance,
        rightsStatus: "cleared",
        sourceUrl: input.sourceUrl ?? asset.sourceUrl
      },
      where: { id: asset.id }
    });
  }

  async getReadUrlForAsset(params: { assetId: string; userId: string }): Promise<string> {
    await this.assertLearnerCanReadAsset(params);
    const asset = await this.prisma.mediaAsset.findFirstOrThrow({
      where: { id: params.assetId, status: "active" }
    });
    return this.presignedGetForObjectKey(asset.objectKey);
  }

  presignedGetForObjectKey(objectKey: string, expirySec = 3600) {
    const bucket = this.env.MINIO_BUCKET;
    return this.minio.presignedGetObject(bucket, objectKey, expirySec);
  }

  /**
   * Streams an object from the canonical media bucket for **trusted server callers** only
   * (e.g. kanji stroke SVG keys stored in PostgreSQL). Keys are validated to reduce path abuse.
   */
  async streamPublicBucketObject(objectKey: string): Promise<Readable> {
    MediaService.assertSafeCanonicalObjectKey(objectKey);
    const bucket = this.env.MINIO_BUCKET;
    try {
      return await this.minio.getObject(bucket, objectKey);
    } catch {
      throw new NotFoundException("Object not found in storage");
    }
  }

  private static assertSafeCanonicalObjectKey(key: string): void {
    const t = key.trim();
    if (t.length < 1 || t.length > 512) {
      throw new BadRequestException("Invalid object key length");
    }
    if (t.includes("..")) {
      throw new BadRequestException("Invalid object key");
    }
    if (!/^[\w\-./]+$/.test(t)) {
      throw new BadRequestException("Invalid object key characters");
    }
  }

  private async assertLearnerCanReadAsset(params: { assetId: string; userId: string }) {
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: params.assetId, status: "active" }
    });
    if (!asset) {
      throw new NotFoundException("Media asset not found");
    }
    if (asset.ownerUserId === params.userId) {
      return;
    }
    const linked = await this.prisma.cardMediaLink.findFirst({
      where: {
        assetId: params.assetId,
        card: { userFlashcards: { some: { userId: params.userId } } }
      }
    });
    if (!linked) {
      throw new ForbiddenException("Not allowed to read this media");
    }
  }

  /* ── Admin listing ── */

  /**
   * Direct upload from admin: receives a Buffer, puts it in MinIO, returns a public URL.
   * Used for announcement hero images and other admin content where presigned flow is overkill.
   */
  async adminDirectUpload(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    actorId: string;
  }): Promise<{ url: string; objectKey: string }> {
    await this.ensureBucket();
    const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const objectKey = `admin/${input.actorId}/${randomUUID()}-${safe}`;
    const bucket = this.env.MINIO_BUCKET;

    await this.minio.putObject(bucket, objectKey, input.buffer, input.buffer.length, {
      "Content-Type": input.mimeType,
    });

    // Build a public-accessible URL. In dev, MinIO is at localhost:19000.
    const proto = this.env.MINIO_USE_SSL ? "https" : "http";
    const host = this.env.MINIO_ENDPOINT;
    const port = this.env.MINIO_PORT;
    const url = `${proto}://${host}:${port}/${bucket}/${objectKey}`;

    return { url, objectKey };
  }

  async adminListAssets(params: {
    limit: number;
    mimeType?: string;
    offset: number;
    rightsStatus?: string;
    status?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params.rightsStatus) where.rightsStatus = params.rightsStatus;
    if (params.mimeType) where.mimeType = { startsWith: params.mimeType };
    if (params.status) where.status = params.status;

    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          objectKey: true,
          mimeType: true,
          byteSize: true,
          provider: true,
          rightsStatus: true,
          status: true,
          license: true,
          ownerUserId: true,
          createdAt: true,
          updatedAt: true
        },
        skip: params.offset,
        take: params.limit,
        where
      }),
      this.prisma.mediaAsset.count({ where })
    ]);

    return { items, total };
  }

  async adminSearchAssets(params: {
    limit: number;
    mimeType?: string;
    offset: number;
    rightsStatus?: string;
    status?: string;
    q: string;
  }) {
    const where = {
      ...(params.rightsStatus ? { rightsStatus: params.rightsStatus } : {}),
      ...(params.mimeType ? { mimeType: { startsWith: params.mimeType } } : {}),
      ...(params.status ? { status: params.status } : {}),
      OR: [
        { objectKey: { contains: params.q, mode: "insensitive" as const } },
        { license: { contains: params.q, mode: "insensitive" as const } }
      ]
    };
    const items = await this.prisma.mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      skip: params.offset,
      take: params.limit,
      where
    });
    return { items, total: items.length };
  }

  async adminGetAssetDetail(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException("Media asset not found");
    }
    const [cardLinkCount, audit] = await Promise.all([
      this.prisma.cardMediaLink.count({ where: { assetId: id } }),
      this.prisma.adminAuditLog.findMany({
        include: { actor: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
        where: { targetId: id, targetType: "media.asset" }
      })
    ]);
    return { ...asset, cardLinkCount, audit };
  }

  async adminUpdateMetadata(input: {
    actorId: string;
    id: string;
    license?: string;
    rightsStatus?: "pending_review" | "cleared" | "blocked";
    sourceUrl?: string | null;
    provenance?: Record<string, unknown> | null;
    accessibility?: Record<string, unknown> | null;
    reason: string;
  }) {
    const before = await this.prisma.mediaAsset.findUnique({ where: { id: input.id } });
    if (!before) throw new NotFoundException("Media asset not found");
    const data: Record<string, unknown> = {};
    if (input.license !== undefined) data.license = input.license;
    if (input.rightsStatus !== undefined) data.rightsStatus = input.rightsStatus;
    if (input.sourceUrl !== undefined) data.sourceUrl = input.sourceUrl;
    if (input.provenance !== undefined) data.provenance = input.provenance;
    if (input.accessibility !== undefined) data.accessibility = input.accessibility;
    return this.prisma.$transaction(async (tx) => {
      const next = await tx.mediaAsset.update({ data, where: { id: input.id } });
      await tx.adminAuditLog.create({
        data: {
          action: "media.metadata.update",
          actorId: input.actorId,
          after: next as unknown as object as never,
          before: before as unknown as object as never,
          reason: input.reason,
          targetId: input.id,
          targetType: "media.asset"
        }
      });
      return next;
    });
  }

  async adminSoftDeleteAsset(input: { actorId: string; id: string; reason: string }) {
    const before = await this.prisma.mediaAsset.findUnique({ where: { id: input.id } });
    if (!before) throw new NotFoundException("Media asset not found");
    if (before.status === "deleted") {
      return { ...before, alreadyDeleted: true };
    }
    return this.prisma.$transaction(async (tx) => {
      const next = await tx.mediaAsset.update({
        data: { status: "deleted" },
        where: { id: input.id }
      });
      await tx.adminAuditLog.create({
        data: {
          action: "media.asset.soft_delete",
          actorId: input.actorId,
          after: next as unknown as object as never,
          before: before as unknown as object as never,
          reason: input.reason,
          targetId: input.id,
          targetType: "media.asset"
        }
      });
      return next;
    });
  }

  private async ensureBucket() {
    const bucket = this.env.MINIO_BUCKET;
    const exists = await this.minio.bucketExists(bucket);
    if (!exists) {
      await this.minio.makeBucket(bucket, "us-east-1");
    }
  }
}
