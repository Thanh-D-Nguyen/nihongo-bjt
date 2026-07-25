import { createPrismaClient } from "@nihongo-bjt/database";
import { Injectable } from "@nestjs/common";

import { katakanaToHiragana, type KuromojiToken } from "./japanese-morphology.js";

@Injectable()
export class DictionaryLookupService {
  private readonly prisma = createPrismaClient();

  async lookupForToken(token: KuromojiToken) {
    const [result] = await this.lookupForTokens([token]);
    return result;
  }

  /**
   * Resolve every token with a single indexed lexeme query. A BJT prompt commonly
   * contains 15–40 tokens; doing one query per token made a cold analysis exceed
   * the learner client's timeout even though the question payload had loaded.
   */
  async lookupForTokens(tokens: KuromojiToken[]) {
    if (tokens.length === 0) {
      return [];
    }

    const headwords = new Set<string>();
    const readings = new Set<string>();
    for (const token of tokens) {
      headwords.add(token.surface_form);
      headwords.add(token.basic_form);
      const reading = katakanaToHiragana(token.reading);
      if (reading) {
        headwords.add(reading);
        readings.add(reading);
      } else {
        readings.add(token.surface_form);
      }
    }

    const matches = await this.prisma.lexeme.findMany({
      include: { senses: { orderBy: { id: "asc" }, take: 1 } },
      where: {
        OR: [
          { headword: { in: [...headwords] } },
          { reading: { in: [...readings] } }
        ],
        status: "active"
      }
    });

    return tokens.map((token) => {
      const reading = katakanaToHiragana(token.reading);
      const candidates = matches
        .filter(
          (lexeme) =>
            lexeme.headword === token.surface_form ||
            lexeme.headword === token.basic_form ||
            (reading && (lexeme.reading === reading || lexeme.headword === reading))
        )
        .sort((a, b) => {
          const rank = (headword: string, lexemeReading: string | null) => {
            if (headword === token.surface_form) return 0;
            if (headword === token.basic_form) return 1;
            if (reading && lexemeReading === reading) return 2;
            return 3;
          };
          return rank(a.headword, a.reading) - rank(b.headword, b.reading);
        });
      const selected = candidates.find((lexeme) => lexeme.shortMeaningVi) ?? candidates[0];
      return selected
        ? {
            lexemeId: selected.id,
            shortMeaningVi:
              selected.shortMeaningVi ?? selected.senses[0]?.meaningVi ?? null
          }
        : { lexemeId: null, shortMeaningVi: null };
    });
  }
}
