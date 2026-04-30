import { createPrismaClient } from "@nihongo-bjt/database";
import type { BookmarkTargetType } from "@nihongo-bjt/shared";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class BookmarksService {
  private readonly prisma = createPrismaClient();

  private normalizeType(type: BookmarkTargetType) {
    return type === "word" ? "lexeme" : type;
  }

  async check(userId: string, type: BookmarkTargetType, targetId: string) {
    const targetType = this.normalizeType(type);
    const bookmark = await this.prisma.bookmark.findFirst({
      where: { targetId, targetType, userId }
    });
    return { bookmarked: Boolean(bookmark), bookmarkId: bookmark?.id ?? null, targetId, type };
  }

  async toggle(userId: string, type: BookmarkTargetType, targetId: string) {
    const targetType = this.normalizeType(type);
    await this.assertTargetExists(targetType, targetId);
    const existing = await this.prisma.bookmark.findFirst({
      where: { targetId, targetType, userId }
    });
    if (existing) {
      await this.prisma.bookmark.delete({ where: { id: existing.id } });
      return { bookmarked: false, targetId, type };
    }
    const bookmark = await this.prisma.bookmark.create({
      data: { targetId, targetType, userId }
    });
    return { bookmarked: true, bookmarkId: bookmark.id, targetId, type };
  }

  async list(userId: string, type: BookmarkTargetType, limit: number) {
    const targetType = this.normalizeType(type);
    const rows = await this.prisma.bookmark.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      where: { targetType, userId }
    });
    return { items: rows, limit, type };
  }

  private async assertTargetExists(targetType: string, targetId: string) {
    const exists =
      targetType === "lexeme"
        ? await this.prisma.lexeme.findFirst({ where: { id: targetId, status: "active" } })
        : targetType === "kanji"
          ? await this.prisma.kanji.findFirst({ where: { id: targetId, status: "active" } })
          : await this.prisma.grammarPoint.findFirst({ where: { id: targetId, status: "active" } });
    if (!exists) {
      throw new NotFoundException("Bookmark target not found");
    }
  }
}
