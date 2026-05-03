import { BrainCircuit, Star } from "lucide-react";
import { TeamLogo } from "./TeamLogo";
import { formatMatchStatusLabel, shouldShowLiveMinuteTick } from "../lib/matchStatus";
import type { GoalHighlightSide, NormalizedMatch } from "../types";

interface MatchRowProps {
  match: NormalizedMatch;
  favorite: boolean;
  selected?: boolean;
  goalHighlightSide?: GoalHighlightSide | null;
  onToggleFavorite: (id: string) => void;
  onOpenPrediction: (match: NormalizedMatch) => void;
  onSelect: (match: NormalizedMatch) => void;
}

export function MatchRow({
  match,
  favorite,
  selected = false,
  goalHighlightSide = null,
  onToggleFavorite,
  onOpenPrediction,
  onSelect
}: MatchRowProps) {
  const isLive = match.status.group === "live";
  const isUpcoming = match.status.group === "upcoming";
  const homeScore = formatScore(match.score.home, isUpcoming);
  const awayScore = formatScore(match.score.away, isUpcoming);
  const homeGoal = isLive && (goalHighlightSide === "home" || goalHighlightSide === "both");
  const awayGoal = isLive && (goalHighlightSide === "away" || goalHighlightSide === "both");
  const homeRedCards = match.redCards?.home ?? 0;
  const awayRedCards = match.redCards?.away ?? 0;
  const statusText = formatMatchStatusLabel(match);
  const scoreText = isUpcoming ? "" : `${homeScore}-${awayScore}`;
  const rowLabel = [match.homeTeam.name, match.awayTeam.name, scoreText, statusText].filter(Boolean).join(", ");

  return (
    <article
      className={`matchRow ${match.status.group} ${selected ? "selected" : ""} ${goalHighlightSide ? "goalFlash" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      aria-label={rowLabel}
      onClick={() => onSelect(match)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(match);
        }
      }}
    >
      <div className="matchTime">
        {statusLabel(match, statusText)}
      </div>

      <div className="teamsBlock">
        <div className={`teamLine ${homeGoal ? "scoredGoal" : ""}`}>
          <TeamLogo src={match.homeTeam.logo} label={match.homeTeam.name} size="sm" />
          <div className="teamNameCluster">
            <span>{match.homeTeam.name}</span>
            {homeRedCards > 0 ? <span className="redCardBadge">{homeRedCards}</span> : null}
            {homeGoal ? <b className="goalTag">Goool</b> : null}
          </div>
        </div>
        <div className={`teamLine ${awayGoal ? "scoredGoal" : ""}`}>
          <TeamLogo src={match.awayTeam.logo} label={match.awayTeam.name} size="sm" />
          <div className="teamNameCluster">
            <span>{match.awayTeam.name}</span>
            {awayRedCards > 0 ? <span className="redCardBadge">{awayRedCards}</span> : null}
            {awayGoal ? <b className="goalTag">Goool</b> : null}
          </div>
        </div>
      </div>

      <div className="scoreBlock">
        <span>{homeScore}</span>
        <span>{awayScore}</span>
      </div>

      <button
        className={`iconButton starButton ${favorite ? "active" : ""}`}
        type="button"
        aria-label="Favori"
        aria-pressed={favorite}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(match.id);
        }}
      >
        <Star size={18} />
      </button>

      <button
        className="aiXpRowButton"
        type="button"
        aria-label="aiXp Tahmin"
        onClick={(event) => {
          event.stopPropagation();
          onOpenPrediction(match);
        }}
      >
        <BrainCircuit size={14} />
        <span>aiXp</span>
      </button>
    </article>
  );
}

function formatScore(value: number | null, upcoming: boolean) {
  if (upcoming) return "";
  return value === null ? "-" : String(value);
}

function statusLabel(match: NormalizedMatch, label: string) {
  if (shouldShowLiveMinuteTick(match)) {
    return (
      <span className="liveMinute">
        <span>{label}</span>
        <span className="minuteTick">'</span>
      </span>
    );
  }

  return <span>{label}</span>;
}
