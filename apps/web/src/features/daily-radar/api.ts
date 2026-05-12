import { learnerApiFetchOptional } from "@/lib/learner-api";

import type { DailyRadarHomePayload } from "./types";

export async function fetchDailyRadarHome(locale: string = "vi") {
  const response = await learnerApiFetchOptional(`/api/daily-radar/home?locale=${locale}`);
  if (!response?.ok) {
    throw new Error("daily_radar_home_failed");
  }
  return (await response.json()) as DailyRadarHomePayload;
}
