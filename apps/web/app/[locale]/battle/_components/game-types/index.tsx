"use client";

import type { GameTypeRoundProps } from "./shared-props";
import { SpeedDuelRound } from "./speed-duel-round";
import { KanjiMatchRound } from "./kanji-match-round";
import { ListeningRound } from "./listening-round";
import { BusinessRoleplayRound } from "./business-roleplay-round";
import { BossRushRound } from "./boss-rush-round";
import { MockExamRound } from "./mock-exam-round";
import { TeamRoomRound } from "./team-room-round";
import { TournamentRound } from "./tournament-round";
import { CustomRound } from "./custom-round";

type Props = GameTypeRoundProps & {
  gameType: string | null;
};

/**
 * Routes to the correct per-type round component based on gameType.
 * Falls back to speed_duel (standard MC with speed twist) for unknown types.
 */
export function GameTypeRenderer({ gameType, ...props }: Props) {
  switch (gameType) {
    case "speed_duel":
      return <SpeedDuelRound {...props} />;
    case "kanji_vocab_duel":
      return <KanjiMatchRound {...props} />;
    case "listening_challenge":
      return <ListeningRound {...props} />;
    case "business_roleplay":
      return <BusinessRoleplayRound {...props} />;
    case "boss_rush":
      return <BossRushRound {...props} />;
    case "mock_exam_sprint":
      return <MockExamRound {...props} />;
    case "team_room":
      return <TeamRoomRound {...props} />;
    case "tournament":
      return <TournamentRound {...props} />;
    case "custom":
      return <CustomRound {...props} />;
    default:
      return <SpeedDuelRound {...props} />;
  }
}
