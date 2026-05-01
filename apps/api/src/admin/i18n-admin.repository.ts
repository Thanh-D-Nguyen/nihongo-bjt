import { Injectable, NotFoundException } from "@nestjs/common";
import { createPrismaClient, Prisma, type PrismaClient } from "@nihongo-bjt/database";

const SUPPORTED_LOCALES = ["vi", "ja", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export type I18nKeyListInput = {
  page: number;
  pageSize: number;
  q?: string;
  namespace?: string;
  /** "untranslated" → at least one locale missing or empty; "complete" → all locales filled. */
  status?: "all" | "untranslated" | "complete";
};

type KeyRow = {
  id: bigint;
  namespace: string;
  key: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  translations: { localeCode: string; value: string; updatedAt: Date }[];
};

function summarize(row: KeyRow) {
  const byLocale = new Map(row.translations.map((t) => [t.localeCode, t.value]));
  const values: Record<SupportedLocale, string | null> = { en: null, ja: null, vi: null };
  const status: Record<SupportedLocale, "translated" | "missing" | "empty"> = {
    en: "missing",
    ja: "missing",
    vi: "missing"
  };
  for (const code of SUPPORTED_LOCALES) {
    const v = byLocale.get(code);
    if (v == null) {
      status[code] = "missing";
      values[code] = null;
    } else if (v.trim().length === 0) {
      status[code] = "empty";
      values[code] = "";
    } else {
      status[code] = "translated";
      values[code] = v;
    }
  }
  const complete = SUPPORTED_LOCALES.every((c) => status[c] === "translated");
  return {
    id: String(row.id),
    namespace: row.namespace,
    key: row.key,
    description: row.description,
    values,
    status,
    complete,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

@Injectable()
export class I18nAdminRepository {
  private readonly prisma: PrismaClient = createPrismaClient();

  async list(input: I18nKeyListInput) {
    const where: Prisma.TranslationKeyWhereInput = {};
    if (input.namespace) where.namespace = input.namespace;
    if (input.q) {
      where.OR = [
        { key: { contains: input.q, mode: "insensitive" } },
        { namespace: { contains: input.q, mode: "insensitive" } },
        { description: { contains: input.q, mode: "insensitive" } }
      ];
    }
    // We can't trivially filter by completeness in SQL without a denormalised column, so we filter
    // post-fetch when status is set. Page size is bounded.
    const [rows, totalRaw] = await Promise.all([
      this.prisma.translationKey.findMany({
        include: { translations: true },
        orderBy: [{ namespace: "asc" }, { key: "asc" }],
        skip: input.status && input.status !== "all" ? 0 : (input.page - 1) * input.pageSize,
        take: input.status && input.status !== "all" ? 5000 : input.pageSize,
        where
      }),
      this.prisma.translationKey.count({ where })
    ]);
    let summarized = rows.map((r) => summarize(r as KeyRow));
    if (input.status === "untranslated") summarized = summarized.filter((s) => !s.complete);
    if (input.status === "complete") summarized = summarized.filter((s) => s.complete);
    const total = input.status && input.status !== "all" ? summarized.length : totalRaw;
    const offset = (input.page - 1) * input.pageSize;
    const items =
      input.status && input.status !== "all"
        ? summarized.slice(offset, offset + input.pageSize)
        : summarized;
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async pendingSummary() {
    // Count translation keys where at least one supported locale is missing or empty.
    const allKeys = await this.prisma.translationKey.findMany({
      include: { translations: true },
      orderBy: { id: "asc" }
    });
    let pending = 0;
    let complete = 0;
    const byNamespace = new Map<string, { pending: number; total: number }>();
    for (const row of allKeys) {
      const s = summarize(row as KeyRow);
      const cur = byNamespace.get(s.namespace) ?? { pending: 0, total: 0 };
      cur.total += 1;
      if (s.complete) complete += 1;
      else {
        pending += 1;
        cur.pending += 1;
      }
      byNamespace.set(s.namespace, cur);
    }
    const namespaces = Array.from(byNamespace.entries())
      .map(([namespace, { pending: p, total }]) => ({ namespace, pending: p, total }))
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 20);
    return { complete, namespaces, pending, total: allKeys.length };
  }

  async detail(id: string) {
    const row = await this.prisma.translationKey.findUnique({
      include: { translations: true },
      where: { id: BigInt(id) }
    });
    if (!row) return null;
    const audit = await this.prisma.adminAuditLog.findMany({
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
      where: { targetId: String(row.id), targetType: "i18n.translation" }
    });
    return { ...summarize(row as KeyRow), audit };
  }

  async upsertTranslation(input: {
    actorId: string;
    keyId: string;
    locale: SupportedLocale;
    value: string;
    reason: string;
  }) {
    const id = BigInt(input.keyId);
    const before = await this.prisma.translationKey.findUnique({
      include: { translations: { where: { localeCode: input.locale } } },
      where: { id }
    });
    if (!before) throw new NotFoundException("Translation key not found");
    const beforeValue = before.translations[0]?.value ?? null;

    await this.prisma.$transaction(async (tx) => {
      // Ensure locale exists; will be a no-op if present.
      await tx.locale.upsert({
        create: {
          code: input.locale,
          englishName: input.locale,
          fallbackOrder: 0,
          isEnabled: true,
          nativeName: input.locale
        },
        update: {},
        where: { code: input.locale }
      });
      await tx.translationValue.upsert({
        create: { keyId: id, localeCode: input.locale, value: input.value },
        update: { value: input.value },
        where: { keyId_localeCode: { keyId: id, localeCode: input.locale } }
      });
      await tx.adminAuditLog.create({
        data: {
          action: "admin.i18n.translation.updated",
          actorId: input.actorId,
          after: { locale: input.locale, value: input.value } as Prisma.InputJsonValue,
          before: { locale: input.locale, value: beforeValue } as Prisma.InputJsonValue,
          reason: input.reason,
          targetId: String(id),
          targetType: "i18n.translation"
        }
      });
    });

    return this.detail(input.keyId);
  }
}
