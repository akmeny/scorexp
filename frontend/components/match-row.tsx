"use client";

import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import { MatchFavoriteIcon } from "@/components/favorite-icons";
import {
  formatMinute,
  getStatusTone,
} from "@/lib/format";
import {
  LiveMatchStore,
  useLiveMatch,
} from "@/lib/live-match-store";
import type { LiveMatch } from "@/lib/types";

interface MatchRowByIdProps {
  store: LiveMatchStore;
  matchId: number;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: (matchId: number) => void;
}

interface MatchRowProps {
  match: LiveMatch;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: (matchId: number) => void;
}

function formatScore(score: number | null): string {
  return score === null ? "-" : String(score);
}

export const MatchRowById = memo(function MatchRowById({
  store,
  matchId,
  isSelected,
  isFavorite,
  onToggleFavorite,
}: MatchRowByIdProps) {
  const match = useLiveMatch(store, matchId);

  if (!match) {
    return null;
  }

  return (
    <MatchRow
      match={match}
      isSelected={isSelected}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
    />
  );
});

export const MatchRow = memo(function MatchRow({
  match,
  isSelected,
  isFavorite,
  onToggleFavorite,
}: MatchRowProps) {
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
                decoding="async"
                fetchPriority="low"
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
                decoding="async"
                fetchPriority="low"
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
      </Link>

      <div className="match-row-actions">
        <button
          type="button"
          className={`favorite-toggle match-favorite-toggle ${
            isFavorite ? "is-active" : ""
          }`}
          aria-pressed={isFavorite}
          aria-label={
            isFavorite
              ? "Maçı favorilerden çıkar"
              : "Maçı favorilere ekle"
          }
          onClick={() => onToggleFavorite(match.matchId)}
        >
          <MatchFavoriteIcon active={isFavorite} />
        </button>
      </div>
    </article>
  );
});
