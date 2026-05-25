import { Injectable, Logger } from '@nestjs/common';

export type LotoData = {
  recentResults: number[][];
  frequencyMap: Record<number, number>;
  hotNumbers: number[];
  coldNumbers: number[];
};

@Injectable()
export class LotoDataProvider {
  private readonly logger = new Logger(LotoDataProvider.name);

  // Phase 2: integrate real Loto 6 / Loto 7 API from mizuho-bk or scraping service
  async fetchLotoData(): Promise<LotoData> {
    this.logger.debug('Generating statistical mock loto data (Phase 2: real API integration)');
    return this.generateStatisticalMock();
  }

  private generateStatisticalMock(): LotoData {
    const frequencyMap: Record<number, number> = {};
    for (let i = 1; i <= 45; i++) {
      frequencyMap[i] = Math.floor(Math.random() * 80) + 20;
    }

    const sorted = Object.entries(frequencyMap)
      .map(([num, freq]) => ({ num: parseInt(num, 10), freq }))
      .sort((a, b) => b.freq - a.freq);

    const hotNumbers = sorted.slice(0, 6).map((e) => e.num);
    const coldNumbers = sorted.slice(-6).map((e) => e.num);

    const recentResults: number[][] = [];
    for (let i = 0; i < 5; i++) {
      const draw: number[] = [];
      while (draw.length < 6) {
        const n = Math.floor(Math.random() * 45) + 1;
        if (!draw.includes(n)) draw.push(n);
      }
      recentResults.push(draw.sort((a, b) => a - b));
    }

    return { recentResults, frequencyMap, hotNumbers, coldNumbers };
  }
}
