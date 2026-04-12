"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import {
  formatEventLine,
  formatKickoff,
  formatLastUpdated,
  formatMinute,
  getStatusTone,
} from "@/lib/format";
import {
  LiveMatchStore,
  useLiveMatch,
} from "@/lib/live-match-store";
import { isLiveStatus } from "@/lib/matches";
import type { LiveMatch } from "@/lib/types";

interface MatchRowByIdProps {
  store: LiveMatchStore;
  matchId: number;
  isSelected: boolean;
}

interface MatchRowProps {
  match: LiveMatch;
  isSelected: boolean;
}

function formatScore(score: number | null): string {
  return score === null ? "-" : String(score);
}

export const MatchRowById = memo(function MatchRowById({
  store,
  matchId,
  isSelected,
}: MatchRowByIdProps) {
  const match = useLiveMatch(store, matchId);

  if (!match) {
    return null;
  }

  return <MatchRow match={match} isSelected={isSelected} />;
});

export const MatchRow = memo(function MatchRow({
  match,
  isSelected,
}: MatchRowProps) {
  const latestEvent = match.eventsSummary?.latest ?? null;
  const latestEventLabel = latestEvent
    ? formatEventLine(latestEvent)
    : isLiveStatus(match.statusShort)
      ? "Waiting for event feed"
      : "No events yet";
  const previousUpdatedAtRef = useRef(match.lastUpdatedAt);
  const [isFresh, setIsFresh] = useState(false);

  useEffect(() => {
    if (previousUpdatedAtRef.current === match.lastUpdatedAt) {
      return;
    }

    previousUpdatedAtRef.current = match.lastUpdatedAt;
    setIsFresh(true);

    const timer = window.setTimeout(() => {
      setIsFresh(false);
    }, 1400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [match.lastUpdatedAt]);

  return (
    <article
      className={`match-row ${isSelected ? "is-selected" : ""} ${
        isFresh ? "is-fresh" : ""
      }`}
    >
      <Link
        href={`/?matchId=${match.matchId}`}
        scroll={false}
        className="match-row-main"
      >
        <div className="match-status-column">
          <span className={`status-pill ${getStatusTone(match.statusShort)}`}>
            {formatMinute(match)}
          </span>
          <span className="status-label">{match.statusLong}</span>
        </div>

        <div className="match-teams-column">
          <div className="team-line">
            {match.homeTeam.logo ? (
              <img
                src={match.homeTeam.logo}
                alt=""
                width={20}
                height={20}
                loading="lazy"
                className="team-logo"
              />
            ) : (
              <span className="team-logo team-logo-fallback" />
            )}
            <span className="team-name">{match.homeTeam.name}</span>
          </div>
          <div className="team-line">
            {match.awayTeam.logo ? (
              <img
                src={match.awayTeam.logo}
                alt=""
                width={20}
                height={20}
                loading="lazy"
                className="team-logo"
              />
            ) : (
              <span className="team-logo team-logo-fallback" />
            )}
            <span className="team-name">{match.awayTeam.name}</span>
          </div>
        </div>

        <div className="match-score-column" aria-label="Current score">
          <span>{formatScore(match.homeScore)}</span>
          <span>{formatScore(match.awayScore)}</span>
        </div>

        <div className="match-meta-column">
          <span className="kickoff-label">{formatKickoff(match.startTime)}</span>
          <span className="latest-event">{latestEventLabel}</span>
          <span className={`freshness-chip ${isFresh ? "is-fresh" : ""}`}>
            {isFresh
              ? "Just updated"
              : `Updated ${formatLastUpdated(match.lastUpdatedAt)}`}
          </span>
        </div>
      </Link>

      <Link href={`/match/${match.matchId}`} className="detail-link">
        Page
      </Link>
    </article>
  );
});
