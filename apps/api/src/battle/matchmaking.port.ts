/**
 * PvP matchmaking is not implemented in phase 08; this port keeps
 * a stable seam for a future Redis/queue-based implementation.
 */
export abstract class MatchmakingPort {
  abstract releaseUser(userId: string): void;
}

export class InMemoryMatchmakingStub extends MatchmakingPort {
  releaseUser() {
    /* future: dequeue */
  }
}
