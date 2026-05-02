import { Star } from "lucide-react";
import { TeamLogo } from "./TeamLogo";
import type { NormalizedMatch } from "../types";

interface MatchRowProps {
  match: NormalizedMatch;
  favorite: boolean;
  showOdds: boolean;
  onToggleFavorite: (id: string) => void;
}

export function MatchRow({ match, favorite, showOdds, onToggleFavorite }: MatchRowProps) {
  const isLive = match.status.group === "live";
  const isUpcoming = match.status.group === "upcoming";
  const homeScore = formatScore(match.score.home, isUpcoming);
  const awayScore = formatScore(match.score.away, isUpcoming);

  return (
    <article className={`matchRow ${isLive ? "live" : ""}`}>
      <div className="matchTime">
        {isLive ? <span className="liveMark" /> : null}
        <span>{isLive ? `${match.status.minute ?? ""}'` : match.localTime}</span>
        <small>{statusShort(match)}</small>
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

      {showOdds ? (
        <div className="oddsMini" aria-label="Oranlar">
          <span>-</span>
          <span>-</span>
          <span>-</span>
        </div>
      ) : null}

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

function statusShort(match: NormalizedMatch) {
  if (match.status.group === "live") return match.status.description === "Half time" ? "HT" : "CANLI";
  if (match.status.group === "finished") return "MS";
  return "-";
}
