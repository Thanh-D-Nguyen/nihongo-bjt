import { createPrismaClient } from "@nihongo-bjt/database";
import type { CompanionTip } from "@nihongo-bjt/shared";
import { Injectable } from "@nestjs/common";

const CATEGORIES = ["grammar", "vocab", "keigo", "culture", "business"] as const;

@Injectable()
export class CompanionTipService {
  private readonly prisma = createPrismaClient();

  async getRandomTip(category?: string): Promise<CompanionTip> {
    const where: Record<string, unknown> = { active: true };
    if (category && CATEGORIES.includes(category as typeof CATEGORIES[number])) {
      where.category = category;
    }
    const count = await this.prisma.companionTip.count({ where });
    if (count === 0) {
      return { id: "fallback", category: "grammar", contentJa: "頑張りましょう！", contentVi: "Cố lên nào!" };
    }
    const skip = Math.floor(Math.random() * count);
    const row = await this.prisma.companionTip.findFirst({ where, skip, orderBy: { sortOrder: "asc" } });
    return this.toDto(row!);
  }

  getCategories(): string[] {
    return [...CATEGORIES];
  }

  async listAll(): Promise<CompanionTip[]> {
    const rows = await this.prisma.companionTip.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(this.toDto);
  }

  async listActive(): Promise<CompanionTip[]> {
    const rows = await this.prisma.companionTip.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map(this.toDto);
  }

  async create(data: {
    category: string;
    contentJa: string;
    contentVi: string;
    exampleJa?: string;
    exampleVi?: string;
    jlptLevel?: string;
    sortOrder?: number;
  }) {
    const row = await this.prisma.companionTip.create({ data: {
      category: data.category,
      contentJa: data.contentJa,
      contentVi: data.contentVi,
      exampleJa: data.exampleJa ?? null,
      exampleVi: data.exampleVi ?? null,
      jlptLevel: data.jlptLevel ?? null,
      sortOrder: data.sortOrder ?? 0,
    }});
    return this.toDto(row);
  }

  async update(id: string, data: {
    category?: string;
    contentJa?: string;
    contentVi?: string;
    exampleJa?: string | null;
    exampleVi?: string | null;
    jlptLevel?: string | null;
    active?: boolean;
    sortOrder?: number;
  }) {
    const row = await this.prisma.companionTip.update({ where: { id }, data });
    return this.toDto(row);
  }

  async remove(id: string) {
    await this.prisma.companionTip.delete({ where: { id } });
    return { deleted: true };
  }

  private toDto(row: {
    id: string;
    category: string;
    contentJa: string;
    contentVi: string;
    exampleJa: string | null;
    exampleVi: string | null;
    jlptLevel: string | null;
    active: boolean;
    sortOrder: number;
  }): CompanionTip & { active: boolean; sortOrder: number } {
    return {
      id: row.id,
      category: row.category as CompanionTip["category"],
      contentJa: row.contentJa,
      contentVi: row.contentVi,
      ...(row.exampleJa ? { exampleJa: row.exampleJa } : {}),
      ...(row.exampleVi ? { exampleVi: row.exampleVi } : {}),
      ...(row.jlptLevel ? { jlptLevel: row.jlptLevel } : {}),
      active: row.active,
      sortOrder: row.sortOrder,
    };
  }
}
