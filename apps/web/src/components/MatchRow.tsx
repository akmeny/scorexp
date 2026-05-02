import { Star } from "lucide-react";
import { TeamLogo } from "./TeamLogo";
import type { GoalHighlightSide, NormalizedMatch } from "../types";

interface MatchRowProps {
  match: NormalizedMatch;
  favorite: boolean;
  selected?: boolean;
  goalHighlightSide?: GoalHighlightSide | null;
  onToggleFavorite: (id: string) => void;
  onSelect: (match: NormalizedMatch) => void;
}

export function MatchRow({
  match,
  favorite,
  selected = false,
  goalHighlightSide = null,
  onToggleFavorite,
  onSelect
}: MatchRowProps) {
  const isLive = match.status.group === "live";
  const isUpcoming = match.status.group === "upcoming";
  const homeScore = formatScore(match.score.home, isUpcoming);
  const awayScore = formatScore(match.score.away, isUpcoming);
  const homeGoal = isLive && (goalHighlightSide === "home" || goalHighlightSide === "both");
  const awayGoal = isLive && (goalHighlightSide === "away" || goalHighlightSide === "both");

  return (
    <article
      className={`matchRow ${match.status.group} ${selected ? "selected" : ""} ${goalHighlightSide ? "goalFlash" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(match)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(match);
        }
      }}
    >
      <div className="matchTime">
        {statusLabel(match)}
      </div>

      <div className="teamsBlock">
        <div className={`teamLine ${homeGoal ? "scoredGoal" : ""}`}>
          <TeamLogo src={match.homeTeam.logo} label={match.homeTeam.name} size="sm" />
          <span>{match.homeTeam.name}</span>
          {homeGoal ? <b className="goalTag">Goool</b> : null}
        </div>
        <div className={`teamLine ${awayGoal ? "scoredGoal" : ""}`}>
          <TeamLogo src={match.awayTeam.logo} label={match.awayTeam.name} size="sm" />
          <span>{match.awayTeam.name}</span>
          {awayGoal ? <b className="goalTag">Goool</b> : null}
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
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite(match.id);
        }}
      >
        <Star size={18} />
      </button>
    </article>
  );
}

function formatScore(value: number | null, upcoming: boolean) {
  if (upcoming) return "";
  return value === null ? "-" : String(value);
}

function statusLabel(match: NormalizedMatch) {
  if (match.status.group === "live") {
    if (match.status.minute !== null) {
      return (
        <span className="liveMinute">
          <span>{match.status.minute}</span>
          <span className="minuteTick">'</span>
        </span>
      );
    }
    return <span>{match.status.description === "Half time" ? "D.A." : ""}</span>;
  }
  if (match.status.group === "finished") return <span>MS</span>;
  return <span>{match.localTime}</span>;
}
