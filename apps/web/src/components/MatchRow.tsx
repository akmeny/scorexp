import { Star } from "lucide-react";
import { TeamLogo } from "./TeamLogo";
import type { NormalizedMatch } from "../types";

interface MatchRowProps {
  match: NormalizedMatch;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export function MatchRow({ match, favorite, onToggleFavorite }: MatchRowProps) {
  const isLive = match.status.group === "live";
  const isUpcoming = match.status.group === "upcoming";
  const homeScore = formatScore(match.score.home, isUpcoming);
  const awayScore = formatScore(match.score.away, isUpcoming);

  return (
    <article className={`matchRow ${match.status.group}`}>
      <div className="matchTime">
        {isLive ? <span className="liveMark" /> : null}
        <span>{statusLabel(match)}</span>
      </div>

      <div className="teamsBlock">
        <div className="teamLine">
          <TeamLogo src={match.homeTeam.logo} label={match.homeTeam.name} size="sm" />
          <span>{match.homeTeam.name}</span>
        </div>
        <div className="teamLine">
          <TeamLogo src={match.awayTeam.logo} label={match.awayTeam.name} size="sm" />
          <span>{match.awayTeam.name}</span>
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
        onClick={() => onToggleFavorite(match.id)}
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
    if (match.status.minute !== null) return `${match.status.minute}'`;
    return match.status.description === "Half time" ? "HT" : "";
  }
  if (match.status.group === "finished") return "MS";
  return match.localTime;
}
