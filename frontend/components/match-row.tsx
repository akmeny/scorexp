"use client";

import Link from "next/link";
import { memo } from "react";
import { MatchFavoriteIcon } from "@/components/favorite-icons";
import { formatMinute, getStatusTone } from "@/lib/format";
import { LiveMatchStore, useLiveMatch } from "@/lib/live-match-store";
import type { LiveMatch, MatchFormResult, MatchFormSnapshot } from "@/lib/types";

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

function getFormArrow(result: MatchFormResult): string {
  if (result === "W") {
    return "↑";
  }

  if (result === "D") {
    return "↔";
  }

  if (result === "L") {
    return "↓";
  }

  return "•";
}

const TeamFormStrip = memo(function TeamFormStrip({
  form,
  teamName,
}: {
  form: MatchFormSnapshot | null | undefined;
  teamName: string;
}) {
  if (!form?.last5.length) {
    return null;
  }

  return (
    <div
      className="team-form-strip"
      aria-label={`${teamName} son 5 maç formu`}
      title={`${teamName} son 5 maç formu`}
    >
      {form.last5.map((result, index) => (
        <span
          key={`${teamName}-${index}-${result}`}
          className={`team-form-chip is-${result.toLowerCase()}`}
          aria-hidden="true"
        >
          {getFormArrow(result)}
        </span>
      ))}
    </div>
  );
});

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
  const showPreMatchForm = match.statusShort === "NS";

  return (
    <article className={`match-row ${isSelected ? "is-selected" : ""}`}>
      <Link href={`/?matchId=${match.matchId}`} scroll={false} className="match-row-main">
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
            <div className="team-line-content">
              <span className="team-name">{match.homeTeam.name}</span>
              {showPreMatchForm ? (
                <TeamFormStrip form={match.homeForm} teamName={match.homeTeam.name} />
              ) : null}
            </div>
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
            <div className="team-line-content">
              <span className="team-name">{match.awayTeam.name}</span>
              {showPreMatchForm ? (
                <TeamFormStrip form={match.awayForm} teamName={match.awayTeam.name} />
              ) : null}
            </div>
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
          className={`favorite-toggle match-favorite-toggle ${isFavorite ? "is-active" : ""}`}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? "Maçı favorilerden çıkar" : "Maçı favorilere ekle"}
          onClick={() => onToggleFavorite(match.matchId)}
        >
          <MatchFavoriteIcon active={isFavorite} />
        </button>
      </div>
    </article>
  );
});
