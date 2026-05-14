import { Injectable } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";

const VALID_FORMATS = ["banner", "modal"] as const;
const VALID_TARGETS = ["all", "free_only", "premium_only"] as const;

type CreateData = {
  type: string;
  message: string;
  href?: string | null;
  active?: boolean;
  sortOrder?: number;
  format?: string;
  target?: string;
  priority?: number;
  titleVi?: string | null;
  titleEn?: string | null;
  titleJa?: string | null;
  bodyVi?: string | null;
  bodyEn?: string | null;
  bodyJa?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  imageUrl?: string | null;
  effect?: string;
  bgPreset?: string;
  allowCloseButton?: boolean;
  allowClickOutside?: boolean;
  dismissDelay?: number;
  showFrequency?: string;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  createdBy?: string | null;
};

type UpdateData = Partial<CreateData>;

@Injectable()
export class AnnouncementRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async listAll() {
    return this.prisma.announcement.findMany({
      orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async listActive() {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        active: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  /** Active announcements filtered by dismissed IDs. */
  async listActiveForUser(userId: string) {
    const now = new Date();
    const dismissed = await this.prisma.announcementDismissal.findMany({
      where: { userId },
      select: { announcementId: true },
    });
    const dismissedIds = dismissed.map((d) => d.announcementId);

    return this.prisma.announcement.findMany({
      where: {
        active: true,
        ...(dismissedIds.length > 0 ? { id: { notIn: dismissedIds } } : {}),
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async findById(id: string) {
    return this.prisma.announcement.findUnique({ where: { id } });
  }

  async create(data: CreateData) {
    return this.prisma.announcement.create({ data: this.cleanData(data) as never });
  }

  async update(id: string, data: UpdateData) {
    return this.prisma.announcement.update({ where: { id }, data: this.cleanData(data) as never });
  }

  async remove(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }

  async dismiss(announcementId: string, userId: string) {
    return this.prisma.announcementDismissal.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: {},
    });
  }

  /** Ensure format/target values are valid. */
  private cleanData(data: Record<string, unknown>): Record<string, unknown> {
    const out = { ...data };
    if (out.format && !VALID_FORMATS.includes(out.format as (typeof VALID_FORMATS)[number])) {
      out.format = "banner";
    }
    if (out.target && !VALID_TARGETS.includes(out.target as (typeof VALID_TARGETS)[number])) {
      out.target = "all";
    }
    if (out.startsAt && typeof out.startsAt === "string") out.startsAt = new Date(out.startsAt);
    if (out.endsAt && typeof out.endsAt === "string") out.endsAt = new Date(out.endsAt);
    return out;
  }
}
