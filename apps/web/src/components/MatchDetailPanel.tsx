import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  CalendarClock,
  CloudSun,
  MapPin,
  RefreshCw,
  Square,
  Target,
  Trophy,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { TeamLogo } from "./TeamLogo";
import type { MatchDetail, MatchDetailEvent, MatchDetailStatistic, NormalizedMatch } from "../types";

interface MatchDetailPanelProps {
  match: NormalizedMatch;
  detail: MatchDetail | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onClose: () => void;
  onReload: () => void;
}

type DetailTab = "details" | "events" | "stats";

const statisticPriority = [
  "Possession",
  "Shots on target",
  "Shots off target",
  "Corners",
  "Free Kicks",
  "Throw-Ins",
  "Goal Kicks",
  "Offsides",
  "Yellow cards",
  "Red cards"
];

const statisticLabels: Record<string, string> = {
  Possession: "Topa sahip olma",
  "Shots on target": "İsabetli şut",
  "Shots off target": "İsabetsiz şut",
  Corners: "Korner",
  "Free Kicks": "Serbest vuruş",
  "Throw-Ins": "Taç",
  "Goal Kicks": "Aut atışı",
  Offsides: "Ofsayt",
  "Yellow cards": "Sarı kart",
  "Red cards": "Kırmızı kart"
};

const eventLabels: Record<string, string> = {
  Goal: "Gol",
  "Own Goal": "Kendi kalesine",
  Penalty: "Penaltı",
  "Missed Penalty": "Kaçan penaltı",
  "Yellow Card": "Sarı kart",
  "Red Card": "Kırmızı kart",
  Substitution: "Oyuncu değişikliği",
  "VAR Goal Confirmed": "VAR gol onayı",
  "VAR Goal Cancelled": "VAR gol iptali",
  "VAR Penalty": "VAR penaltı",
  "VAR Penalty Cancelled": "VAR penaltı iptali",
  "VAR Goal Cancelled - Offside": "VAR ofsayt"
};

export function MatchDetailPanel({
  match,
  detail,
  loading,
  refreshing,
  error,
  onClose,
  onReload
}: MatchDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>("details");
  const activeMatch = detail?.match ?? match;
  const prediction = detail?.predictions.latestLive ?? detail?.predictions.latestPrematch ?? null;
  const statisticRows = useMemo(() => buildStatisticRows(activeMatch, detail), [activeMatch, detail]);

  useEffect(() => {
    setTab("details");
  }, [match.id]);

  return (
    <aside className="matchDetailPane" aria-label="Maç detayı">
      <header className="detailTop">
        <div>
          <span>{activeMatch.country.name}</span>
          <strong>{activeMatch.league.name}</strong>
          {activeMatch.round ? <em>{activeMatch.round}</em> : null}
        </div>
        <div className="detailTopActions">
          <button className="iconButton" type="button" aria-label="Detayı yenile" onClick={onReload}>
            <RefreshCw className={refreshing ? "syncSpin" : undefined} size={17} />
          </button>
          <button className="iconButton" type="button" aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </header>

      <section className="detailScoreHero">
        <TeamSummary match={activeMatch} side="home" />
        <div className="detailScoreCenter">
          <strong>{formatScore(activeMatch.score.home, activeMatch.status.group === "upcoming")}</strong>
          <span>-</span>
          <strong>{formatScore(activeMatch.score.away, activeMatch.status.group === "upcoming")}</strong>
          <small>{formatStatus(activeMatch)}</small>
        </div>
        <TeamSummary match={activeMatch} side="away" />
      </section>

      {loading ? <div className="detailNotice">Detaylar yükleniyor</div> : null}
      {error ? <div className="detailNotice">{error}</div> : null}

      <nav className="detailTabs" aria-label="Maç detay sekmeleri">
        <button className={tab === "details" ? "active" : ""} type="button" onClick={() => setTab("details")}>
          Ayrıntılar
        </button>
        <button className={tab === "events" ? "active" : ""} type="button" onClick={() => setTab("events")}>
          Olaylar
        </button>
        <button className={tab === "stats" ? "active" : ""} type="button" onClick={() => setTab("stats")}>
          İstatistik
        </button>
      </nav>

      {tab === "details" ? (
        <div className="detailContent">
          <div className="detailFactGrid">
            <DetailFact icon={<CalendarClock size={16} />} label="Tarih ve saat" value={`${formatDate(activeMatch.date)} • ${activeMatch.localTime}`} />
            <DetailFact icon={<Trophy size={16} />} label="Lig" value={activeMatch.league.name} />
            <DetailFact icon={<Activity size={16} />} label="Durum" value={activeMatch.status.description} />
            <DetailFact icon={<Target size={16} />} label="Tur" value={activeMatch.round} />
            <DetailFact icon={<UserRound size={16} />} label="Hakem" value={formatReferee(detail)} />
            <DetailFact icon={<MapPin size={16} />} label="Stat" value={formatVenue(detail)} />
            <DetailFact icon={<CloudSun size={16} />} label="Hava" value={formatForecast(detail)} />
          </div>

          {prediction ? (
            <section className="predictionBlock">
              <div className="sectionTitle">Tahmin</div>
              <div className="probabilityGrid">
                <Probability label="1" value={prediction.probabilities.home} />
                <Probability label="X" value={prediction.probabilities.draw} />
                <Probability label="2" value={prediction.probabilities.away} />
              </div>
              {prediction.description ? <p>{prediction.description}</p> : null}
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "events" ? (
        <div className="detailContent">
          {detail?.events.length ? (
            <div className="eventTimeline">
              {detail.events.map((event, index) => (
                <EventRow key={`${event.time ?? "na"}:${event.type}:${event.team.id}:${index}`} event={event} match={activeMatch} />
              ))}
            </div>
          ) : (
            <EmptyDetail text="Olay verisi yok." />
          )}
        </div>
      ) : null}

      {tab === "stats" ? (
        <div className="detailContent">
          {statisticRows.length ? (
            <div className="statCompareList">
              <div className="statTeams">
                <span>{activeMatch.homeTeam.name}</span>
                <BarChart3 size={16} />
                <span>{activeMatch.awayTeam.name}</span>
              </div>
              {statisticRows.map((row) => (
                <div className="statCompareRow" key={row.name}>
                  <div className="statValues">
                    <strong>{row.homeDisplay}</strong>
                    <span>{row.label}</span>
                    <strong>{row.awayDisplay}</strong>
                  </div>
                  <div className="statBars" aria-hidden="true">
                    <i style={{ width: `${row.homePercent}%` }} />
                    <b style={{ width: `${row.awayPercent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyDetail text="İstatistik verisi yok." />
          )}
        </div>
      ) : null}
    </aside>
  );
}

function TeamSummary({ match, side }: { match: NormalizedMatch; side: "home" | "away" }) {
  const team = side === "home" ? match.homeTeam : match.awayTeam;

  return (
    <div className="detailTeamSummary">
      <TeamLogo src={team.logo} label={team.name} size="md" />
      <span>{team.name}</span>
    </div>
  );
}

function DetailFact({ icon, label, value }: { icon: ReactNode; label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="detailFact">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Probability({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="probabilityItem">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

function EventRow({ event, match }: { event: MatchDetailEvent; match: NormalizedMatch }) {
  const side = event.team.id === match.homeTeam.id ? "home" : event.team.id === match.awayTeam.id ? "away" : "neutral";

  return (
    <div className={`eventRow ${side}`}>
      <span className="eventMinute">{event.time ? `${event.time}'` : "-"}</span>
      <span className={`eventIcon ${eventClass(event.type)}`}>{eventIcon(event.type)}</span>
      <div>
        <strong>{eventLabels[event.type] ?? event.type}</strong>
        <span>{[event.player, event.assist ? `Asist: ${event.assist}` : null, event.substituted].filter(Boolean).join(" • ") || event.team.name}</span>
      </div>
    </div>
  );
}

function EmptyDetail({ text }: { text: string }) {
  return <div className="emptyDetail">{text}</div>;
}

function buildStatisticRows(match: NormalizedMatch, detail: MatchDetail | null) {
  const home = detail?.statistics.find((group) => group.team.id === match.homeTeam.id)?.statistics ?? [];
  const away = detail?.statistics.find((group) => group.team.id === match.awayTeam.id)?.statistics ?? [];
  const homeMap = new Map(home.map((item) => [item.displayName, item]));
  const awayMap = new Map(away.map((item) => [item.displayName, item]));
  const names = Array.from(new Set([...statisticPriority, ...home.map((item) => item.displayName), ...away.map((item) => item.displayName)]));

  return names
    .filter((name) => homeMap.has(name) || awayMap.has(name))
    .map((name) => {
      const homeValue = homeMap.get(name)?.value ?? null;
      const awayValue = awayMap.get(name)?.value ?? null;
      const homeNumber = comparableStatValue(name, homeValue);
      const awayNumber = comparableStatValue(name, awayValue);
      const total = Math.max(homeNumber + awayNumber, 0);

      return {
        name,
        label: statisticLabels[name] ?? name,
        homeDisplay: formatStatValue(name, homeValue),
        awayDisplay: formatStatValue(name, awayValue),
        homePercent: total > 0 ? Math.max(6, (homeNumber / total) * 100) : 50,
        awayPercent: total > 0 ? Math.max(6, (awayNumber / total) * 100) : 50
      };
    });
}

function eventIcon(type: string) {
  if (type.includes("Goal") || type.includes("Penalty")) return <Target size={14} />;
  if (type.includes("Card")) return <Square size={14} />;
  if (type.includes("Substitution")) return <ArrowLeftRight size={14} />;
  return <Activity size={14} />;
}

function eventClass(type: string) {
  if (type.includes("Red")) return "red";
  if (type.includes("Yellow")) return "yellow";
  if (type.includes("Goal") || type.includes("Penalty")) return "goal";
  return "";
}

function formatScore(value: number | null, upcoming: boolean) {
  if (upcoming) return "";
  return value === null ? "-" : String(value);
}

function formatStatus(match: NormalizedMatch) {
  if (match.status.group === "live") {
    return match.status.minute !== null ? `${match.status.minute}'` : match.status.description;
  }

  if (match.status.group === "finished") return "MS";
  return match.localTime;
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(parsed);
}

function formatVenue(detail: MatchDetail | null) {
  const venue = detail?.venue;
  if (!venue) return null;
  return [venue.name, venue.city, venue.country].filter(Boolean).join(" • ") || null;
}

function formatReferee(detail: MatchDetail | null) {
  const referee = detail?.referee;
  if (!referee) return null;
  return [referee.name, referee.nationality].filter(Boolean).join(" • ") || null;
}

function formatForecast(detail: MatchDetail | null) {
  const forecast = detail?.forecast;
  if (!forecast) return null;
  const temperature = forecast.temperature !== null && forecast.temperature !== undefined ? `${forecast.temperature}°` : null;
  return [forecast.status, temperature].filter(Boolean).join(" • ") || null;
}

function comparableStatValue(name: string, value: MatchDetailStatistic["value"]) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace("%", ""));
  if (!Number.isFinite(parsed)) return 0;
  if (name === "Possession" && parsed > 1) return parsed / 100;
  return parsed;
}

function formatStatValue(name: string, value: MatchDetailStatistic["value"]) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = typeof value === "number" ? value : Number(String(value).replace("%", ""));

  if (Number.isFinite(parsed) && (name === "Possession" || (parsed > 0 && parsed < 1))) {
    return `${Math.round((name === "Possession" && parsed > 1 ? parsed / 100 : parsed) * 100)}%`;
  }

  return String(value);
}
