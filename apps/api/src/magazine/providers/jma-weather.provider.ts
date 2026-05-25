import { Injectable, Logger } from '@nestjs/common';

export type WeatherData = {
  city: string;
  date: string;
  condition: string;
  temperatureHigh: number;
  temperatureLow: number;
  precipitation: number;
  humidity: number;
};

const JMA_FORECAST_URL = 'https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json';

@Injectable()
export class JmaWeatherProvider {
  private readonly logger = new Logger(JmaWeatherProvider.name);

  async fetchWeather(): Promise<WeatherData> {
    try {
      const response = await fetch(JMA_FORECAST_URL);

      if (!response.ok) {
        this.logger.warn(`JMA API returned ${response.status}, using fallback`);
        return this.getFallbackData();
      }

      const data = (await response.json()) as Array<{
        timeSeries?: Array<{
          timeDefines?: string[];
          areas?: Array<{
            area?: { name?: string };
            weathers?: string[];
            temps?: string[];
          }>;
        }>;
      }>;

      const forecast = data[0]?.timeSeries;
      if (!forecast || forecast.length === 0) {
        this.logger.warn('JMA API response has no timeSeries, using fallback');
        return this.getFallbackData();
      }

      const weatherSeries = forecast[0];
      const tempSeries = forecast[2];

      const city = weatherSeries?.areas?.[0]?.area?.name ?? '東京';
      const date = weatherSeries?.timeDefines?.[0]?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
      const condition = weatherSeries?.areas?.[0]?.weathers?.[0] ?? '晴れ';

      const temps = tempSeries?.areas?.[0]?.temps ?? [];
      const temperatureLow = parseInt(temps[0] ?? '15', 10);
      const temperatureHigh = parseInt(temps[1] ?? '25', 10);

      return {
        city,
        date,
        condition,
        temperatureHigh,
        temperatureLow,
        precipitation: 0,
        humidity: 60,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch JMA weather: ${error instanceof Error ? error.message : String(error)}`);
      return this.getFallbackData();
    }
  }

  private getFallbackData(): WeatherData {
    return {
      city: '東京',
      date: new Date().toISOString().slice(0, 10),
      condition: '晴れ時々曇り',
      temperatureHigh: 26,
      temperatureLow: 18,
      precipitation: 10,
      humidity: 55,
    };
  }
}
