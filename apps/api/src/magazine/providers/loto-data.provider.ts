import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { createPrismaClient, type PrismaClient } from "@nihongo-bjt/database";

import { LotoLabService } from "../loto/loto-lab.service.js";
import type { LotoGame } from "../loto/loto-types.js";

export type LotoData = {
  game: LotoGame;
  recentResults: number[][];
  frequencyMap: Record<number, number>;
  hotNumbers: number[];
  coldNumbers: number[];
  overdueNumbers: number[];
  generatedSets?: Array<{ mainNumbers: number[]; bonusNumbers: number[]; score: number }>;
  japaneseSentence?: unknown;
};

@Injectable()
export class LotoDataProvider {
  private readonly logger = new Logger(LotoDataProvider.name);
  private readonly prisma: PrismaClient = createPrismaClient();

  constructor(private readonly lotoLab: LotoLabService) {}

  async getHistoricalData(game: LotoGame = "loto6"): Promise<LotoData> {
    return this.fetchLotoData(game);
  }

  async fetchLotoData(game: LotoGame): Promise<LotoData> {
    let count = await this.prisma.lotoDraw.count({ where: { game } });
    if (count < 10) {
      this.logger.log(`Only ${count} ${game} draws in DB; synchronizing the configured CSV source`);
      await this.lotoLab.fetchAndImportCsv(game);
      count = await this.prisma.lotoDraw.count({ where: { game } });
    }
    if (count >= 10) {
      const data = await this.lotoLab.latestData(game);
      return {
        game,
        recentResults: data.recentResults,
        frequencyMap: data.frequencyMap,
        hotNumbers: data.hotNumbers,
        coldNumbers: data.coldNumbers,
        overdueNumbers: data.overdueNumbers,
        generatedSets: data.generatedSets,
        japaneseSentence: data.japaneseSentence
      };
    }

    throw new ServiceUnavailableException(
      `The ${game} source returned only ${count} historical draws; at least 10 are required`
    );
  }
}
