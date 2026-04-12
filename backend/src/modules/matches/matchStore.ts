import type { MatchFreshness, NormalizedMatch } from "./types.js";
import { compareMatches } from "./types.js";

export class MatchStore {
  private matches = new Map<number, NormalizedMatch>();

  private freshness = new Map<number, MatchFreshness>();

  private lastAttemptAt: string | null = null;

  private lastSuccessfulPollAt: string | null = null;

  private lastError: string | null = null;

  getMap(): Map<number, NormalizedMatch> {
    return new Map(this.matches);
  }

  replace(
    nextMatches: Map<number, NormalizedMatch>,
    nextFreshness: Map<number, MatchFreshness>,
  ): void {
    this.matches = nextMatches;
    this.freshness = nextFreshness;
  }

  getAll(): NormalizedMatch[] {
    return [...this.matches.values()].sort(compareMatches);
  }

  getById(matchId: number): NormalizedMatch | null {
    return this.matches.get(matchId) ?? null;
  }

  getFreshness(matchId: number): MatchFreshness | null {
    return this.freshness.get(matchId) ?? null;
  }

  getFreshnessSnapshot(limit = 10): MatchFreshness[] {
    return [...this.freshness.values()].slice(0, limit);
  }

  size(): number {
    return this.matches.size;
  }

  setLastAttemptAt(timestamp: string): void {
    this.lastAttemptAt = timestamp;
  }

  setLastSuccessfulPollAt(timestamp: string): void {
    this.lastSuccessfulPollAt = timestamp;
  }

  setLastError(message: string | null): void {
    this.lastError = message;
  }

  getMeta(): {
    count: number;
    freshnessTrackedCount: number;
    lastAttemptAt: string | null;
    lastSuccessfulPollAt: string | null;
    lastError: string | null;
  } {
    return {
      count: this.matches.size,
      freshnessTrackedCount: this.freshness.size,
      lastAttemptAt: this.lastAttemptAt,
      lastSuccessfulPollAt: this.lastSuccessfulPollAt,
      lastError: this.lastError,
    };
  }
}
