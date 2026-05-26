import { Injectable, Logger } from '@nestjs/common';
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
    const count = await this.prisma.lotoDraw.count({ where: { game } });
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
        japaneseSentence: data.japaneseSentence,
      };
    }

    this.logger.warn(`Only ${count} ${game} draws in DB, using statistical fallback`);
    return this.generateStatisticalMock(game);
  }

  private generateStatisticalMock(game: LotoGame): LotoData {
    const max = game === "loto7" ? 37 : 43;
    const mainCount = game === "loto7" ? 7 : 6;
    const frequencyMap: Record<number, number> = {};
    for (let i = 1; i <= max; i++) {
      frequencyMap[i] = Math.floor(Math.random() * 80) + 20;
    }

    const sorted = Object.entries(frequencyMap)
      .map(([num, freq]) => ({ num: parseInt(num, 10), freq }))
      .sort((a, b) => b.freq - a.freq);

    const hotNumbers = sorted.slice(0, mainCount).map((e) => e.num);
    const coldNumbers = sorted.slice(-mainCount).map((e) => e.num);

    const recentResults: number[][] = [];
    for (let i = 0; i < 5; i++) {
      const draw: number[] = [];
      while (draw.length < mainCount) {
        const n = Math.floor(Math.random() * max) + 1;
        if (!draw.includes(n)) draw.push(n);
      }
      recentResults.push(draw.sort((a, b) => a - b));
    }

    return { game, recentResults, frequencyMap, hotNumbers, coldNumbers, overdueNumbers: coldNumbers };
  }
}
