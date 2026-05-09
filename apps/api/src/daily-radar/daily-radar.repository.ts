import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";

const ACTIVE_STATUSES = new Set(["draft", "published", "archived"]);

type ListInput = {
  category?: string;
  limit: number;
  moduleKey?: string;
  page: number;
  status?: string;
};

type ModuleInput = {
  category: string;
  defaultPriority?: number;
  descriptionJa?: string | null;
  descriptionVi: string;
  disclaimerJa?: string | null;
  disclaimerVi?: string | null;
  externalUrl?: string | null;
  iconKey?: string | null;
  isEnabled?: boolean;
  isSpotlightEligible?: boolean;
  metadata?: unknown;
  moduleKey: string;
  moduleType: string;
  routePath?: string | null;
  status?: string;
  titleEn?: string | null;
  titleJa: string;
  titleVi: string;
  visualTheme?: string | null;
};

type CardInput = {
  badgeTextVi?: string | null;
  category: string;
  ctaLabelJa?: string | null;
  ctaLabelVi: string;
  descriptionVi: string;
  endsAt?: Date | null;
  estimatedMinutes?: number | null;
  iconKey?: string | null;
  imageUrl?: string | null;
  isPinned?: boolean;
  isSpotlight?: boolean;
  levelLabel?: string | null;
  metadata?: unknown;
  moduleConfigId: string;
  moduleType: string;
  priority?: number;
  recommendationReasonVi?: string | null;
  slug: string;
  startsAt?: Date | null;
  status?: string;
  subtitleVi?: string | null;
  targetEntityId?: string | null;
  targetEntityType?: string | null;
  targetRoute?: string | null;
  titleJa?: string | null;
  titleVi: string;
  visualTheme?: string | null;
};

@Injectable()
export class DailyRadarRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async home() {
    const now = new Date();
    const where = this.publicCardWhere(now);
    const cards = await this.prisma.dailyRadarCard.findMany({
      include: { moduleConfig: true },
      orderBy: [{ isPinned: "desc" }, { priority: "desc" }, { updatedAt: "desc" }],
      take: 100,
      where
    });
    const spotlight =
      cards.find((card) => card.isSpotlight && card.moduleConfig.isSpotlightEligible) ??
      cards.find((card) => card.isPinned) ??
      cards[0] ??
      null;
    const modules = await this.publicModules();
    const categories = this.categoriesFrom(modules, cards);
    return {
      cards: cards.map((card) => this.serializeCard(card)),
      categories,
      modules: modules.map((module) => this.serializeModule(module)),
      spotlight: spotlight ? this.serializeCard(spotlight) : null
    };
  }

  async publicCards(input: Pick<ListInput, "category" | "limit" | "moduleKey">) {
    const now = new Date();
    const where = this.publicCardWhere(now);
    if (input.category) where.category = input.category;
    if (input.moduleKey) where.moduleConfig = { moduleKey: input.moduleKey, status: "published", isEnabled: true };
    const rows = await this.prisma.dailyRadarCard.findMany({
      include: { moduleConfig: true },
      orderBy: [{ isPinned: "desc" }, { priority: "desc" }, { updatedAt: "desc" }],
      take: input.limit,
      where
    });
    return rows.map((row) => this.serializeCard(row));
  }

  async publicModules() {
    return this.prisma.dailyRadarModuleConfig.findMany({
      orderBy: [{ defaultPriority: "desc" }, { updatedAt: "desc" }],
      where: { isEnabled: true, status: "published" }
    });
  }

  async adminSummary() {
    const [totalModules, enabledModules, publishedCards, draftCards, archivedCards, spotlight] =
      await Promise.all([
        this.prisma.dailyRadarModuleConfig.count(),
        this.prisma.dailyRadarModuleConfig.count({ where: { isEnabled: true, status: "published" } }),
        this.prisma.dailyRadarCard.count({ where: { status: "published" } }),
        this.prisma.dailyRadarCard.count({ where: { status: "draft" } }),
        this.prisma.dailyRadarCard.count({ where: { status: "archived" } }),
        this.prisma.dailyRadarCard.findFirst({
          orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
          select: { id: true, titleVi: true },
          where: { isSpotlight: true, status: "published" }
        })
      ]);
    return { archivedCards, draftCards, enabledModules, publishedCards, spotlight, totalModules };
  }

  async listModules(input: ListInput) {
    const where: Prisma.DailyRadarModuleConfigWhereInput = {};
    if (input.category) where.category = input.category;
    if (input.status) where.status = input.status;
    const [items, total] = await Promise.all([
      this.prisma.dailyRadarModuleConfig.findMany({
        orderBy: [{ defaultPriority: "desc" }, { updatedAt: "desc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        where
      }),
      this.prisma.dailyRadarModuleConfig.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.limit, total };
  }

  async getModule(id: string) {
    const row = await this.prisma.dailyRadarModuleConfig.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Daily Radar module not found");
    return row;
  }

  async createModule(actorId: string, data: ModuleInput) {
    this.assertStatus(data.status ?? "draft");
    const row = await this.prisma.dailyRadarModuleConfig.create({
      data: this.moduleData(data)
    });
    await this.audit(actorId, "admin.daily_radar.module.created", row.id, null, row);
    return row;
  }

  async patchModule(actorId: string, id: string, data: Partial<ModuleInput>) {
    if (data.status) this.assertStatus(data.status);
    const before = await this.getModule(id);
    const after = await this.prisma.dailyRadarModuleConfig.update({
      data: this.moduleData(data),
      where: { id }
    });
    await this.audit(actorId, "admin.daily_radar.module.updated", id, before, after);
    return after;
  }

  async archiveModule(actorId: string, id: string) {
    const before = await this.getModule(id);
    const after = await this.prisma.dailyRadarModuleConfig.update({
      data: { isEnabled: false, status: "archived" },
      where: { id }
    });
    await this.audit(actorId, "admin.daily_radar.module.archived", id, before, after);
    return after;
  }

  async listCards(input: ListInput) {
    const where: Prisma.DailyRadarCardWhereInput = {};
    if (input.category) where.category = input.category;
    if (input.status) where.status = input.status;
    if (input.moduleKey) where.moduleConfig = { moduleKey: input.moduleKey };
    const [items, total] = await Promise.all([
      this.prisma.dailyRadarCard.findMany({
        include: { moduleConfig: { select: { moduleKey: true, titleVi: true } } },
        orderBy: [{ isPinned: "desc" }, { priority: "desc" }, { updatedAt: "desc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        where
      }),
      this.prisma.dailyRadarCard.count({ where })
    ]);
    return { items, page: input.page, pageSize: input.limit, total };
  }

  async getCard(id: string) {
    const row = await this.prisma.dailyRadarCard.findUnique({ include: { moduleConfig: true }, where: { id } });
    if (!row) throw new NotFoundException("Daily Radar card not found");
    return row;
  }

  async createCard(actorId: string, data: CardInput) {
    this.assertStatus(data.status ?? "draft");
    this.assertDateWindow(data.startsAt, data.endsAt);
    await this.getModule(data.moduleConfigId);
    const row = await this.prisma.dailyRadarCard.create({ data: this.cardData(data) });
    await this.audit(actorId, "admin.daily_radar.card.created", row.id, null, row);
    return this.getCard(row.id);
  }

  async patchCard(actorId: string, id: string, data: Partial<CardInput>) {
    if (data.status) this.assertStatus(data.status);
    this.assertDateWindow(data.startsAt, data.endsAt);
    if (data.moduleConfigId) await this.getModule(data.moduleConfigId);
    const before = await this.getCard(id);
    const after = await this.prisma.dailyRadarCard.update({ data: this.cardData(data), where: { id } });
    await this.audit(actorId, "admin.daily_radar.card.updated", id, before, after);
    return this.getCard(after.id);
  }

  async transitionCard(actorId: string, id: string, status: "archived" | "published") {
    const before = await this.getCard(id);
    const after = await this.prisma.dailyRadarCard.update({ data: { status }, where: { id } });
    await this.audit(actorId, `admin.daily_radar.card.${status}`, id, before, after);
    return this.getCard(after.id);
  }

  async duplicateCard(actorId: string, id: string) {
    const before = await this.getCard(id);
    const row = await this.prisma.dailyRadarCard.create({
      data: {
        badgeTextVi: before.badgeTextVi,
        category: before.category,
        ctaLabelJa: before.ctaLabelJa,
        ctaLabelVi: before.ctaLabelVi,
        descriptionVi: before.descriptionVi,
        endsAt: before.endsAt,
        estimatedMinutes: before.estimatedMinutes,
        iconKey: before.iconKey,
        imageUrl: before.imageUrl,
        levelLabel: before.levelLabel,
        metadata: before.metadata as Prisma.InputJsonValue,
        moduleConfigId: before.moduleConfigId,
        moduleType: before.moduleType,
        priority: before.priority,
        recommendationReasonVi: before.recommendationReasonVi,
        startsAt: before.startsAt,
        subtitleVi: before.subtitleVi,
        targetEntityId: before.targetEntityId,
        targetEntityType: before.targetEntityType,
        targetRoute: before.targetRoute,
        titleJa: before.titleJa,
        visualTheme: before.visualTheme,
        isPinned: false,
        isSpotlight: false,
        slug: `${before.slug}-copy-${Date.now()}`,
        status: "draft",
        titleVi: `${before.titleVi} (copy)`
      }
    });
    await this.audit(actorId, "admin.daily_radar.card.duplicated", row.id, { sourceId: id }, row);
    return this.getCard(row.id);
  }

  private publicCardWhere(now: Date): Prisma.DailyRadarCardWhereInput {
    return {
      moduleConfig: { isEnabled: true, status: "published" },
      status: "published",
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
      ]
    };
  }

  private categoriesFrom(modules: Awaited<ReturnType<DailyRadarRepository["publicModules"]>>, cards: Array<{ category: string }>) {
    return [...new Set([...modules.map((m) => m.category), ...cards.map((c) => c.category)])];
  }

  private serializeModule(row: Prisma.DailyRadarModuleConfigGetPayload<object>) {
    return row;
  }

  private serializeCard(row: Prisma.DailyRadarCardGetPayload<{ include: { moduleConfig: true } }>) {
    return {
      ...row,
      module: {
        disclaimerJa: row.moduleConfig.disclaimerJa,
        disclaimerVi: row.moduleConfig.disclaimerVi,
        moduleKey: row.moduleConfig.moduleKey,
        titleJa: row.moduleConfig.titleJa,
        titleVi: row.moduleConfig.titleVi
      }
    };
  }

  private moduleData(data: Partial<ModuleInput>): Prisma.DailyRadarModuleConfigUncheckedCreateInput {
    return {
      ...data,
      metadata: data.metadata == null ? undefined : (data.metadata as Prisma.InputJsonValue)
    } as Prisma.DailyRadarModuleConfigUncheckedCreateInput;
  }

  private cardData(data: Partial<CardInput>): Prisma.DailyRadarCardUncheckedCreateInput {
    return {
      ...data,
      metadata: data.metadata == null ? undefined : (data.metadata as Prisma.InputJsonValue)
    } as Prisma.DailyRadarCardUncheckedCreateInput;
  }

  private assertStatus(status: string) {
    if (!ACTIVE_STATUSES.has(status)) {
      throw new BadRequestException({ code: "invalid_status", status });
    }
  }

  private assertDateWindow(startsAt?: Date | null, endsAt?: Date | null) {
    if (startsAt && endsAt && startsAt >= endsAt) {
      throw new BadRequestException({ code: "invalid_date_window" });
    }
  }

  private async audit(actorId: string, action: string, targetId: string, before: unknown, after: unknown) {
    await this.prisma.adminAuditLog.create({
      data: {
        action,
        actorId,
        after: after == null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue),
        before: before == null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue),
        targetId,
        targetType: "daily.daily_radar"
      }
    });
  }
}
