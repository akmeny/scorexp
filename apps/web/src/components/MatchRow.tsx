import { BrainCircuit, Star } from "lucide-react";
import { TeamLogo } from "./TeamLogo";
import { formatMatchStatusLabel, shouldShowLiveMinuteTick } from "../lib/matchStatus";
import type { MatchGoalHighlight, NormalizedMatch } from "../types";

type LiveMetricValue = number | string | null | undefined;
type MatchLiveMetrics = {
  pressure?: LiveMetricValue;
  pressureValue?: LiveMetricValue;
  momentum?: LiveMetricValue;
  momentumValue?: LiveMetricValue;
  metrics?: {
    pressure?: LiveMetricValue;
    momentum?: LiveMetricValue;
  };
  live?: {
    pressure?: LiveMetricValue;
    momentum?: LiveMetricValue;
  };
  liveState?: {
    pressure?: LiveMetricValue;
    momentum?: LiveMetricValue;
  };
};

interface MatchRowProps {
  match: NormalizedMatch;
  favorite: boolean;
  selected?: boolean;
  goalHighlight?: MatchGoalHighlight | null;
  onToggleFavorite: (id: string) => void;
  onOpenPrediction: (match: NormalizedMatch) => void;
  onSelect: (match: NormalizedMatch) => void;
}

export function MatchRow({
  match,
  favorite,
  selected = false,
  goalHighlight = null,
  onToggleFavorite,
  onOpenPrediction,
  onSelect
}: MatchRowProps) {
  const isLive = match.status.group === "live";
  const isUpcoming = match.status.group === "upcoming";
  const homeScore = formatScore(match.score.home, isUpcoming);
  const awayScore = formatScore(match.score.away, isUpcoming);
  const activeGoalHighlight = isLive ? goalHighlight : null;
  const isGoalPending = activeGoalHighlight?.phase === "pending";
  const isGoalConfirmed = activeGoalHighlight?.phase === "confirmed";
  const homeRedCards = match.redCards?.home ?? 0;
  const awayRedCards = match.redCards?.away ?? 0;
  const statusText = formatMatchStatusLabel(match);
  const scoreText = isUpcoming ? "" : `${homeScore}-${awayScore}`;
  const rowLabel = [match.homeTeam.name, match.awayTeam.name, scoreText, statusText].filter(Boolean).join(", ");
  const pressure = isLive ? readLiveMetric(match, "pressure") : null;
  const momentum = isLive ? readLiveMetric(match, "momentum") : null;
  const liveIndicatorColor = isLive ? intensityColor(pressure ?? 100) : null;
  const momentumColor = momentum === null ? null : intensityColor(momentum);
  const homeGoalActive = isGoalConfirmed && isGoalSide(activeGoalHighlight?.side ?? null, "home");
  const awayGoalActive = isGoalConfirmed && isGoalSide(activeGoalHighlight?.side ?? null, "away");
  const rowClassName = [
    "matchRow",
    match.status.group,
    selected ? "selected" : "",
    isGoalPending ? "goalPending" : "",
    isGoalConfirmed ? "goalConfirmed" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={rowClassName}
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
      {pressure !== null ? <span className="pressureLine" style={{ backgroundColor: intensityColor(pressure) }} aria-hidden="true" /> : null}

      <div className="matchTime">
        {statusLabel(match, statusText, liveIndicatorColor)}
      </div>

      <div className="teamsBlock">
        <div className={homeGoalActive ? "teamLine goalTeam" : "teamLine"}>
          <TeamLogo src={match.homeTeam.logo} label={match.homeTeam.name} size="sm" />
          <div className="teamNameCluster">
            <span>{match.homeTeam.name}</span>
            {homeGoalActive ? <span className="goalTag">Gol</span> : null}
            {homeRedCards > 0 ? <span className="redCardBadge">{homeRedCards}</span> : null}
          </div>
        </div>
        <div className={awayGoalActive ? "teamLine goalTeam" : "teamLine"}>
          <TeamLogo src={match.awayTeam.logo} label={match.awayTeam.name} size="sm" />
          <div className="teamNameCluster">
            <span>{match.awayTeam.name}</span>
            {awayGoalActive ? <span className="goalTag">Gol</span> : null}
            {awayRedCards > 0 ? <span className="redCardBadge">{awayRedCards}</span> : null}
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

      {momentum !== null && momentumColor ? (
        <span className="momentumBar" aria-hidden="true">
          <span className="momentumFill" style={{ width: `${momentum}%`, backgroundColor: momentumColor }} />
        </span>
      ) : null}
    </article>
  );
}

function formatScore(value: number | null, upcoming: boolean) {
  if (upcoming) return "";
  return value === null ? "-" : String(value);
}

function statusLabel(match: NormalizedMatch, label: string, liveIndicatorColor: string | null) {
  const pulseDot = liveIndicatorColor ? (
    <span className="livePulseDot" style={{ backgroundColor: liveIndicatorColor }} aria-hidden="true" />
  ) : null;

  if (shouldShowLiveMinuteTick(match)) {
    return (
      <span className="liveMinute">
        {pulseDot}
        <span>{label}</span>
        <span className="minuteTick">'</span>
      </span>
    );
  }

  if (pulseDot) {
    return (
      <span className="liveMinute">
        {pulseDot}
        <span>{label}</span>
      </span>
    );
  }

  return <span>{label}</span>;
}

function readLiveMetric(match: NormalizedMatch, metric: "pressure" | "momentum") {
  const source = match as NormalizedMatch & MatchLiveMetrics;
  const value =
    metric === "pressure"
      ? firstMetricValue(source.pressure, source.pressureValue, source.metrics?.pressure, source.live?.pressure, source.liveState?.pressure)
      : firstMetricValue(source.momentum, source.momentumValue, source.metrics?.momentum, source.live?.momentum, source.liveState?.momentum);

  return clampPercent(value);
}

function firstMetricValue(...values: LiveMetricValue[]) {
  return values.find((value) => value !== null && value !== undefined) ?? null;
}

function clampPercent(value: LiveMetricValue) {
  if (value === null || value === undefined || value === "") return null;

  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return null;

  return Math.max(0, Math.min(100, numeric));
}

function intensityColor(value: number) {
  if (value < 40) return "#22C55E";
  if (value < 70) return "#F59E0B";
  return "#EF4444";
}

function isGoalSide(side: MatchGoalHighlight["side"] | null, target: "home" | "away") {
  return side === target || side === "both";
}
