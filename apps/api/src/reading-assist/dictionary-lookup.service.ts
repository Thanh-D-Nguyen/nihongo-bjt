import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

import { katakanaToHiragana, type KuromojiToken } from "./japanese-morphology.js";

@Injectable()
export class DictionaryLookupService {
  private readonly prisma = createPrismaClient();

  async lookupForToken(token: KuromojiToken) {
    const surface = token.surface_form;
    const base = token.basic_form;
    const readingH = katakanaToHiragana(token.reading);

    const tryLexemes = () =>
      this.prisma.lexeme.findMany({
        include: { senses: { orderBy: { id: "asc" }, take: 1 } },
        take: 3,
        where: {
          OR: [
            { headword: surface },
            { headword: base },
            ...(readingH
              ? [{ reading: readingH } as const, { headword: readingH } as const]
              : [{ reading: surface } as const, { headword: surface } as const])
          ],
          status: "active"
        }
      });

    const matches = await tryLexemes();
    if (matches.length === 0) {
      return { lexemeId: null, shortMeaningVi: null };
    }
    const [first, ...rest] = matches;
    const withMeaning = [first, ...rest].find((l) => l.shortMeaningVi) ?? first;
    return {
      lexemeId: withMeaning.id,
      shortMeaningVi: withMeaning.shortMeaningVi ?? withMeaning.senses[0]?.meaningVi ?? null
    };
  }
}
