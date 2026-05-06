import { Injectable } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";

@Injectable()
export class AnnouncementRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async listAll() {
    return this.prisma.announcement.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async listActive() {
    return this.prisma.announcement.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async findById(id: string) {
    return this.prisma.announcement.findUnique({ where: { id } });
  }

  async create(data: { type: string; message: string; href?: string | null; active?: boolean; sortOrder?: number }) {
    return this.prisma.announcement.create({ data });
  }

  async update(id: string, data: { type?: string; message?: string; href?: string | null; active?: boolean; sortOrder?: number }) {
    return this.prisma.announcement.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }
}
