"use client";

import Link from "next/link";
import { memo } from "react";
import { MatchFavoriteIcon } from "@/components/favorite-icons";
import { RedCardBadge, TeamNoticeBadge } from "@/components/match-live-badges";
import { formatMinute, getStatusTone } from "@/lib/format";
import { LiveMatchStore, useLiveMatch } from "@/lib/live-match-store";
import { useMatchPresentation } from "@/lib/live-match-presentation";
import type {
  LiveMatch,
  MatchFormEntry,
  MatchFormResult,
  MatchFormSnapshot,
} from "@/lib/types";

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
    return "\u2191";
  }

  if (result === "D") {
    return "\u2194";
  }

  if (result === "L") {
    return "\u2193";
  }

  return "\u2022";
}

function formatFormTooltip(entry: MatchFormEntry): string {
  const homeScore = entry.isHome ? entry.goalsFor : entry.goalsAgainst;
  const awayScore = entry.isHome ? entry.goalsAgainst : entry.goalsFor;

  return `${homeScore ?? "-"}-${awayScore ?? "-"} ${entry.opponentName}`;
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
      {form.last5.map((entry, index) => (
        <span
          key={`${teamName}-${index}-${entry.result}-${entry.opponentName}`}
          className="team-form-chip-shell"
        >
          <span
            className={`team-form-chip is-${entry.result.toLowerCase()}`}
            aria-label={`${teamName} form maçı: ${formatFormTooltip(entry)}`}
            title={formatFormTooltip(entry)}
          >
            {getFormArrow(entry.result)}
          </span>
          <span className="team-form-tooltip" role="tooltip">
            {formatFormTooltip(entry)}
          </span>
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
  const statusTone = getStatusTone(match.statusShort);
  const presentation = useMatchPresentation(match);
  const rowStateClass = [
    presentation.isScoreStripeActive ? "has-score-stripe" : "",
    presentation.isLiveIntroActive ? "is-live-intro" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={`match-row ${statusTone} ${isSelected ? "is-selected" : ""} ${rowStateClass}`}>
      <Link href={`/?matchId=${match.matchId}`} scroll={false} className="match-row-main">
        <div className="match-status-column">
          <span className={`status-pill ${statusTone}`}>
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
              <RedCardBadge count={match.homeRedCards} />
              <TeamNoticeBadge notice={presentation.homeNotice} />
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
              <RedCardBadge count={match.awayRedCards} />
              <TeamNoticeBadge notice={presentation.awayNotice} />
              {showPreMatchForm ? (
                <TeamFormStrip form={match.awayForm} teamName={match.awayTeam.name} />
              ) : null}
            </div>
          </div>
        </div>

        <div className="match-score-column" aria-label="Current score">
          <span>{formatScore(presentation.displayHomeScore)}</span>
          <span>{formatScore(presentation.displayAwayScore)}</span>
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
