import type {
  MatchDiff,
  MatchEventsSummary,
  MatchEventSummaryItem,
  MatchPatch,
  MatchPatchChanges,
  NormalizedMatch,
  NormalizedMatchInput,
  RemovedMatch,
  TeamSummary,
} from "./types.js";
import { compareMatches } from "./types.js";

export interface ReconcileResult {
  nextMatches: Map<number, NormalizedMatch>;
  diff: MatchDiff;
  hasChanges: boolean;
}

interface RemovalOverride {
  statusShort: string;
  statusLong: string;
  reason: RemovedMatch["reason"];
}

const finalStatuses = new Set([
  "FT",
  "AET",
  "PEN",
  "ABD",
  "AWD",
  "WO",
  "CANC",
]);

function sameTeam(left: TeamSummary, right: TeamSummary): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.logo === right.logo
  );
}

function sameEventItem(
  left: MatchEventSummaryItem,
  right: MatchEventSummaryItem,
): boolean {
  return (
    left.minute === right.minute &&
    left.extraMinute === right.extraMinute &&
    left.teamId === right.teamId &&
    left.teamName === right.teamName &&
    left.playerName === right.playerName &&
    left.type === right.type &&
    left.detail === right.detail
  );
}

function sameEventSummary(
  left: MatchEventsSummary | null,
  right: MatchEventsSummary | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  if (
    left.total !== right.total ||
    left.goals !== right.goals ||
    left.cards !== right.cards
  ) {
    return false;
  }

  if (Boolean(left.latest) !== Boolean(right.latest)) {
    return false;
  }

  if (left.latest && right.latest && !sameEventItem(left.latest, right.latest)) {
    return false;
  }

  if (left.recent.length !== right.recent.length) {
    return false;
  }

  for (let index = 0; index < left.recent.length; index += 1) {
    const leftItem = left.recent[index];
    const rightItem = right.recent[index];

    if (!leftItem || !rightItem || !sameEventItem(leftItem, rightItem)) {
      return false;
    }
  }

  return true;
}

function sameMatch(
  previous: NormalizedMatch,
  next: NormalizedMatchInput,
): boolean {
  return (
    previous.matchId === next.matchId &&
    previous.leagueId === next.leagueId &&
    previous.leagueName === next.leagueName &&
    previous.country === next.country &&
    previous.startTime === next.startTime &&
    previous.statusShort === next.statusShort &&
    previous.statusLong === next.statusLong &&
    previous.minute === next.minute &&
    sameTeam(previous.homeTeam, next.homeTeam) &&
    sameTeam(previous.awayTeam, next.awayTeam) &&
    previous.homeScore === next.homeScore &&
    previous.awayScore === next.awayScore &&
    sameEventSummary(previous.eventsSummary, next.eventsSummary)
  );
}

function inferRemovalReason(statusShort: string): RemovedMatch["reason"] {
  return finalStatuses.has(statusShort) ? "finished" : "no-longer-live";
}

function createMatchPatch(
  previous: NormalizedMatch,
  next: NormalizedMatch,
): MatchPatch {
  const changes: MatchPatchChanges = {};

  if (previous.leagueId !== next.leagueId) {
    changes.leagueId = next.leagueId;
  }

  if (previous.leagueName !== next.leagueName) {
    changes.leagueName = next.leagueName;
  }

  if (previous.country !== next.country) {
    changes.country = next.country;
  }

  if (previous.startTime !== next.startTime) {
    changes.startTime = next.startTime;
  }

  if (previous.statusShort !== next.statusShort) {
    changes.statusShort = next.statusShort;
  }

  if (previous.statusLong !== next.statusLong) {
    changes.statusLong = next.statusLong;
  }

  if (previous.minute !== next.minute) {
    changes.minute = next.minute;
  }

  if (!sameTeam(previous.homeTeam, next.homeTeam)) {
    changes.homeTeam = next.homeTeam;
  }

  if (!sameTeam(previous.awayTeam, next.awayTeam)) {
    changes.awayTeam = next.awayTeam;
  }

  if (previous.homeScore !== next.homeScore) {
    changes.homeScore = next.homeScore;
  }

  if (previous.awayScore !== next.awayScore) {
    changes.awayScore = next.awayScore;
  }

  if (!sameEventSummary(previous.eventsSummary, next.eventsSummary)) {
    changes.eventsSummary = next.eventsSummary;
  }

  if (previous.lastUpdatedAt !== next.lastUpdatedAt) {
    changes.lastUpdatedAt = next.lastUpdatedAt;
  }

  return {
    matchId: next.matchId,
    changes,
  };
}

export function reconcileMatches(
  previousMatches: Map<number, NormalizedMatch>,
  latestInputs: NormalizedMatchInput[],
  generatedAt: string,
  removalOverrides: Map<number, RemovalOverride> = new Map(),
): ReconcileResult {
  const nextMatches = new Map<number, NormalizedMatch>();
  const latestById = new Map<number, NormalizedMatchInput>();
  const added: NormalizedMatch[] = [];
  const updated: MatchPatch[] = [];
  const removed: RemovedMatch[] = [];

  for (const input of latestInputs) {
    latestById.set(input.matchId, input);

    const previous = previousMatches.get(input.matchId);

    if (!previous) {
      const addedMatch: NormalizedMatch = {
        ...input,
        lastUpdatedAt: generatedAt,
      };
      nextMatches.set(input.matchId, addedMatch);
      added.push(addedMatch);
      continue;
    }

    if (sameMatch(previous, input)) {
      nextMatches.set(input.matchId, previous);
      continue;
    }

    const updatedMatch: NormalizedMatch = {
      ...input,
      lastUpdatedAt: generatedAt,
    };
    nextMatches.set(input.matchId, updatedMatch);
    updated.push(createMatchPatch(previous, updatedMatch));
  }

  for (const [matchId, previous] of previousMatches) {
    if (latestById.has(matchId)) {
      continue;
    }

    const override = removalOverrides.get(matchId);

    removed.push({
      matchId,
      statusShort: override?.statusShort ?? previous.statusShort,
      statusLong: override?.statusLong ?? previous.statusLong,
      reason: override?.reason ?? inferRemovalReason(previous.statusShort),
    });
  }

  added.sort(compareMatches);
  updated.sort((left, right) => left.matchId - right.matchId);
  removed.sort((left, right) => left.matchId - right.matchId);

  return {
    nextMatches,
    diff: {
      added,
      updated,
      removed,
    },
    hasChanges: added.length > 0 || updated.length > 0 || removed.length > 0,
  };
}
