import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  CloudSun,
  ListOrdered,
  MapPin,
  RefreshCw,
  Sparkles,
  Square,
  Target,
  Trophy,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { TeamLogo } from "./TeamLogo";
import { localizeCountryName } from "../lib/localization";
import { formatMatchStatusLabel } from "../lib/matchStatus";
import type {
  MatchDetail,
  MatchDetailEvent,
  MatchDetailPrediction,
  MatchDetailStatistic,
  MatchDetailStandingRow,
  NormalizedMatch,
  Team
} from "../types";

interface MatchDetailPanelProps {
  match: NormalizedMatch;
  detail: MatchDetail | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onClose: () => void;
  onReload: () => void;
}

type DetailTab = "details" | "events" | "stats" | "h2h" | "form" | "standings";
type AiStatus = "idle" | "analyzing" | "done";

const analysisSteps = [
  "Geçmiş maçlar çekiliyor...",
  "Veriler derleniyor...",
  "Takımların form durumu kontrol ediliyor...",
  "Puan durumu ağırlıkları hesaplanıyor...",
  "Aralarındaki maç kırılımları karşılaştırılıyor...",
  "Oyuncu teknik kapasitesi hesaplanıyor...",
  "Erişilebilir kadro verileri taranıyor...",
  "Eksik/sakat/cezalı bilgisi varsa derleniyor...",
  "Maç ritmi ve saha etkisi modelleniyor...",
  "aiXp sonucu hazırlanıyor..."
];

const statisticPriority = [
  "Possession",
  "Shots on target",
  "Shots off target",
  "Total shots",
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
  "Total shots": "Toplam şut",
  "Blocked shots": "Engellenen şut",
  "Shots inside box": "Ceza sahası içi şut",
  "Shots outside box": "Ceza sahası dışı şut",
  Corners: "Korner",
  "Free Kicks": "Serbest vuruş",
  "Throw-Ins": "Taç",
  "Goal Kicks": "Aut atışı",
  Offsides: "Ofsayt",
  Fouls: "Faul",
  Saves: "Kurtarış",
  "Goalkeeper saves": "Kaleci kurtarışı",
  Passes: "Pas",
  "Accurate passes": "İsabetli pas",
  "Yellow cards": "Sarı kart",
  "Red cards": "Kırmızı kart",
  "Yellow Cards": "Sarı kart",
  "Red Cards": "Kırmızı kart"
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
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiStep, setAiStep] = useState(0);
  const activeMatch = detail?.match ?? match;
  const prediction = detail?.predictions.latestLive ?? detail?.predictions.latestPrematch ?? null;
  const statisticRows = useMemo(() => buildStatisticRows(activeMatch, detail), [activeMatch, detail]);
  const visibleTabs = useMemo(() => buildTabs(activeMatch, detail, statisticRows.length), [activeMatch, detail, statisticRows.length]);
  const aiResult = useMemo(() => buildAiResult(activeMatch, detail, prediction), [activeMatch, detail, prediction]);
  const tabStyle = { "--tab-count": visibleTabs.length } as CSSProperties;

  useEffect(() => {
    setTab("details");
    setAiStatus("idle");
    setAiStep(0);
  }, [match.id]);

  useEffect(() => {
    if (!visibleTabs.some((item) => item.key === tab)) {
      setTab("details");
    }
  }, [tab, visibleTabs]);

  useEffect(() => {
    if (aiStatus !== "analyzing") return;

    const interval = window.setInterval(() => {
      setAiStep((current) => {
        const next = current + 1;
        if (next >= analysisSteps.length) {
          window.clearInterval(interval);
          setAiStatus("done");
          return analysisSteps.length - 1;
        }
        return next;
      });
    }, 2_000);

    return () => window.clearInterval(interval);
  }, [aiStatus]);

  const startAiPrediction = () => {
    setAiStep(0);
    setAiStatus("analyzing");
  };

  return (
    <aside className="matchDetailPane" aria-label="Maç detayı">
      <header className="detailTop">
        <div className="detailLeagueIdentity">
          <LeagueLogo src={activeMatch.league.logo} label={activeMatch.league.name} />
          <div className="detailLeagueMeta">
            <span className="detailLeagueCountry">{localizeCountryName(activeMatch.country.name)}</span>
            <strong title={activeMatch.league.name}>{activeMatch.league.name}</strong>
            {activeMatch.round ? <em title={formatRound(activeMatch.round)}>{formatRound(activeMatch.round)}</em> : null}
          </div>
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

      <nav className={`detailTabs ${visibleTabs.length >= 6 ? "dense" : ""}`} aria-label="Maç detay sekmeleri" style={tabStyle}>
        {visibleTabs.map((item) => (
          <button className={tab === item.key ? "active" : ""} type="button" onClick={() => setTab(item.key)} key={item.key}>
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "details" ? (
        <div className="detailContent">
          <div className="detailFactGrid">
            <DetailFact icon={<CalendarClock size={16} />} label="Tarih ve saat" value={`${formatDate(activeMatch.date)} • ${activeMatch.localTime}`} />
            <DetailFact icon={<Trophy size={16} />} label="Lig" value={activeMatch.league.name} />
            <DetailFact icon={<Activity size={16} />} label="Durum" value={formatStatusDescription(activeMatch.status.description)} />
            <DetailFact icon={<Target size={16} />} label="Tur" value={activeMatch.round ? formatRound(activeMatch.round) : null} />
            <DetailFact icon={<UserRound size={16} />} label="Hakem" value={formatReferee(detail)} />
            <DetailFact icon={<MapPin size={16} />} label="Stat" value={formatVenue(detail)} />
            <DetailFact icon={<CloudSun size={16} />} label="Hava" value={formatForecast(detail)} />
          </div>

          <AiPredictionCard status={aiStatus} step={aiStep} result={aiResult} onStart={startAiPrediction} />
        </div>
      ) : null}

      {tab === "events" ? (
        <div className="detailContent">
          <div className="eventTimeline">
            {detail?.events.map((event, index) => (
              <EventRow key={`${event.time ?? "na"}:${event.type}:${event.team.id}:${index}`} event={event} match={activeMatch} />
            ))}
          </div>
        </div>
      ) : null}

      {tab === "stats" ? (
        <div className="detailContent">
          <StatisticCompare match={activeMatch} rows={statisticRows} />
        </div>
      ) : null}

      {tab === "h2h" ? (
        <div className="detailContent">
          <HeadToHeadView match={activeMatch} matches={detail?.headToHead ?? []} />
        </div>
      ) : null}

      {tab === "form" ? (
        <div className="detailContent">
          <FormView match={activeMatch} homeForm={detail?.form?.home ?? []} awayForm={detail?.form?.away ?? []} />
        </div>
      ) : null}

      {tab === "standings" ? (
        <div className="detailContent">
          <StandingsView match={activeMatch} standings={detail?.standings ?? null} />
        </div>
      ) : null}
    </aside>
  );
}

function buildTabs(match: NormalizedMatch, detail: MatchDetail | null, statisticRowCount: number) {
  const tabs: { key: DetailTab; label: string }[] = [{ key: "details", label: "Ayrıntılar" }];
  const isUpcoming = match.status.group === "upcoming";

  if (!isUpcoming && (detail?.events?.length ?? 0) > 0) tabs.push({ key: "events", label: "Özet" });
  if (!isUpcoming && statisticRowCount > 0) tabs.push({ key: "stats", label: "İstatistik" });
  if ((detail?.headToHead?.length ?? 0) > 0) tabs.push({ key: "h2h", label: "Aralar" });
  if ((detail?.form?.home.length ?? 0) > 0 || (detail?.form?.away.length ?? 0) > 0) tabs.push({ key: "form", label: "Form" });
  if ((detail?.standings?.groups.length ?? 0) > 0) tabs.push({ key: "standings", label: "Puan" });

  return tabs;
}

function LeagueLogo({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span className="detailLeagueLogo fallback" aria-hidden="true">
        {initial}
      </span>
    );
  }

  return <img className="detailLeagueLogo" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

function TeamSummary({ match, side }: { match: NormalizedMatch; side: "home" | "away" }) {
  const team = side === "home" ? match.homeTeam : match.awayTeam;

  return (
    <div className="detailTeamSummary">
      <TeamLogo src={team.logo} label={team.name} size="lg" />
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

function AiPredictionCard({
  status,
  step,
  result,
  onStart
}: {
  status: AiStatus;
  step: number;
  result: ReturnType<typeof buildAiResult>;
  onStart: () => void;
}) {
  const blockRef = useRef<HTMLElement | null>(null);
  const progress = status === "done" ? 100 : status === "analyzing" ? Math.round(((step + 1) / analysisSteps.length) * 100) : 0;

  useEffect(() => {
    if (status === "done") {
      blockRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [status]);

  return (
    <section className={`aiPredictionBlock ${status}`} ref={blockRef}>
      <div className="aiPredictionHeader">
        <span>
          <BrainCircuit size={16} />
          aiXp Tahmin
        </span>
        {status === "idle" ? (
          <button type="button" onClick={onStart}>
            Başlat
          </button>
        ) : null}
      </div>

      {status === "idle" ? (
        <div className="aiPredictionIntro">
          <Sparkles size={18} />
          <span>Maç verilerini aiXp modeliyle analiz et.</span>
        </div>
      ) : null}

      {status === "analyzing" ? (
        <div className="aiAnalysis">
          <div className="aiScanner" aria-hidden="true">
            <span />
          </div>
          <div className="aiLog" aria-live="polite">
            <span className="active" key={analysisSteps[step]}>
              {analysisSteps[step]}
            </span>
          </div>
          <div className="aiProgress" aria-hidden="true">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {status === "done" ? (
        <div className="aiResult">
          <strong>{result.title}</strong>
          <p>{result.summary}</p>
          {result.probabilities ? (
            <div className="aiProbabilityBars">
              {result.probabilities.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                  <i style={{ width: item.value }} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
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

function StatisticCompare({ match, rows }: { match: NormalizedMatch; rows: ReturnType<typeof buildStatisticRows> }) {
  return (
    <div className="statCompareList">
      <div className="statTeams">
        <span>{match.homeTeam.name}</span>
        <BarChart3 size={16} />
        <span>{match.awayTeam.name}</span>
      </div>
      {rows.map((row) => (
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
  );
}

function HeadToHeadView({ match, matches }: { match: NormalizedMatch; matches: NormalizedMatch[] }) {
  const pastMatches = matches.filter((item) => item.id !== match.id);
  const summary = summarizeResults(pastMatches, match.homeTeam, match.awayTeam);

  return (
    <div className="h2hBlock">
      <div className="h2hSummary">
        <SummaryPill label={match.homeTeam.name} value={summary.homeWins} />
        <SummaryPill label="Beraberlik" value={summary.draws} />
        <SummaryPill label={match.awayTeam.name} value={summary.awayWins} />
      </div>
      <div className="compactMatchList">
        {pastMatches.slice(0, 10).map((item) => (
          <CompactMatchRow key={item.id} match={item} focusTeamId={match.homeTeam.id} />
        ))}
      </div>
    </div>
  );
}

function FormView({
  match,
  homeForm,
  awayForm
}: {
  match: NormalizedMatch;
  homeForm: NormalizedMatch[];
  awayForm: NormalizedMatch[];
}) {
  return (
    <div className="formGrid">
      <TeamFormColumn team={match.homeTeam} matches={homeForm} />
      <TeamFormColumn team={match.awayTeam} matches={awayForm} />
    </div>
  );
}

function StandingsView({ match, standings }: { match: NormalizedMatch; standings: MatchDetail["standings"] }) {
  if (!standings) return null;

  return (
    <div className="standingsBlock">
      {standings.groups.map((group) => (
        <section key={group.name}>
          <div className="sectionTitle">
            <ListOrdered size={15} />
            {group.name}
          </div>
          <div className="standingsTable">
            <div className="standingsHead">
              <span>#</span>
              <span>Takım</span>
              <span>O</span>
              <span>AV</span>
              <span>P</span>
            </div>
            {group.rows.map((row) => (
              <StandingRow key={row.team.id} row={row} homeTeamId={match.homeTeam.id} awayTeamId={match.awayTeam.id} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TeamFormColumn({ team, matches }: { team: Team; matches: NormalizedMatch[] }) {
  return (
    <section className="teamFormColumn">
      <div className="teamFormTitle">
        <TeamLogo src={team.logo} label={team.name} size="sm" />
        <span>{team.name}</span>
      </div>
      <div className="formChips">
        {matches.map((match) => {
          const outcome = resultForTeam(match, team.id);
          return (
            <span className={`formChip ${outcome}`} key={match.id}>
              {outcomeLabel(outcome)}
            </span>
          );
        })}
      </div>
      <div className="compactMatchList">
        {matches.map((match) => (
          <CompactMatchRow key={match.id} match={match} focusTeamId={team.id} />
        ))}
      </div>
    </section>
  );
}

function CompactMatchRow({ match, focusTeamId }: { match: NormalizedMatch; focusTeamId: string }) {
  const focusHome = match.homeTeam.id === focusTeamId;
  const opponent = focusHome ? match.awayTeam : match.homeTeam;

  return (
    <div className="compactMatchRow">
      <span>{formatShortDate(match.date)}</span>
      <TeamLogo src={opponent.logo} label={opponent.name} size="sm" />
      <strong>{opponent.name}</strong>
      <b>{formatScoreline(match)}</b>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="summaryPill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StandingRow({
  row,
  homeTeamId,
  awayTeamId
}: {
  row: MatchDetailStandingRow;
  homeTeamId: string;
  awayTeamId: string;
}) {
  const highlighted = row.team.id === homeTeamId || row.team.id === awayTeamId;
  const goalDiff = row.total.scoredGoals - row.total.receivedGoals;

  return (
    <div className={`standingRow ${highlighted ? "highlighted" : ""}`}>
      <span>{row.position ?? "-"}</span>
      <span>
        <TeamLogo src={row.team.logo} label={row.team.name} size="sm" />
        <strong>{row.team.name}</strong>
      </span>
      <span>{row.total.games}</span>
      <span>{goalDiff > 0 ? `+${goalDiff}` : goalDiff}</span>
      <span>{row.points ?? "-"}</span>
    </div>
  );
}

function buildStatisticRows(match: NormalizedMatch, detail: MatchDetail | null) {
  const home = detail?.statistics?.find((group) => group.team.id === match.homeTeam.id)?.statistics ?? [];
  const away = detail?.statistics?.find((group) => group.team.id === match.awayTeam.id)?.statistics ?? [];
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

function buildAiResult(match: NormalizedMatch, detail: MatchDetail | null, prediction: MatchDetailPrediction | null) {
  const probabilities = prediction
    ? [
        { key: "home", label: match.homeTeam.name, value: prediction.probabilities.home },
        { key: "draw", label: "Beraberlik", value: prediction.probabilities.draw },
        { key: "away", label: match.awayTeam.name, value: prediction.probabilities.away }
      ]
        .map((item) => ({ ...item, number: parsePercent(item.value) }))
        .filter((item) => item.number !== null)
    : [];

  if (probabilities.length > 0) {
    const leader = [...probabilities].sort((a, b) => (b.number ?? 0) - (a.number ?? 0))[0];
    const confidence = leader.number && leader.number >= 60 ? "yüksek" : leader.number && leader.number >= 50 ? "orta" : "dengeli";

    return {
      title: `${leader.label} öne çıkıyor`,
      summary: `aiXp analizi ${leader.label} tarafını ${leader.value} ile bir adım öne koyuyor. Güven seviyesi ${confidence}; aralarındaki maçlar, form, puan durumu ve erişilebilir oyuncu verileri birlikte değerlendirildi.`,
      probabilities: probabilities.map((item) => ({ label: item.key === "home" ? "1" : item.key === "draw" ? "X" : "2", value: item.value ?? "0%" }))
    };
  }

  const homeForm = formScore(detail?.form?.home ?? [], match.homeTeam.id);
  const awayForm = formScore(detail?.form?.away ?? [], match.awayTeam.id);
  const title = homeForm === awayForm ? "Dengeli maç" : homeForm > awayForm ? `${match.homeTeam.name} formda` : `${match.awayTeam.name} formda`;

  return {
    title,
    summary: "Sağlayıcı tahmin yüzdesi gelmediği için aiXp sonucu form ve puan durumu sinyallerine göre üretildi. Veri kapsamı sınırlıysa sonuç da temkinli okunmalı.",
    probabilities: null
  };
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

function summarizeResults(matches: NormalizedMatch[], homeTeam: Team, awayTeam: Team) {
  return matches.reduce(
    (summary, match) => {
      const homeScore = match.score.home;
      const awayScore = match.score.away;
      if (homeScore === null || awayScore === null) return summary;
      if (homeScore === awayScore) return { ...summary, draws: summary.draws + 1 };

      const winnerId = homeScore > awayScore ? match.homeTeam.id : match.awayTeam.id;
      if (winnerId === homeTeam.id) return { ...summary, homeWins: summary.homeWins + 1 };
      if (winnerId === awayTeam.id) return { ...summary, awayWins: summary.awayWins + 1 };
      return summary;
    },
    { homeWins: 0, draws: 0, awayWins: 0 }
  );
}

function resultForTeam(match: NormalizedMatch, teamId: string) {
  if (match.score.home === null || match.score.away === null) return "draw";
  if (match.score.home === match.score.away) return "draw";
  const teamHome = match.homeTeam.id === teamId;
  const teamWon = teamHome ? match.score.home > match.score.away : match.score.away > match.score.home;
  return teamWon ? "win" : "loss";
}

function outcomeLabel(outcome: string) {
  if (outcome === "win") return "G";
  if (outcome === "loss") return "M";
  return "B";
}

function formScore(matches: NormalizedMatch[], teamId: string) {
  return matches.reduce((total, match) => {
    const result = resultForTeam(match, teamId);
    if (result === "win") return total + 3;
    if (result === "draw") return total + 1;
    return total;
  }, 0);
}

function formatScore(value: number | null, upcoming: boolean) {
  if (upcoming) return "";
  return value === null ? "-" : String(value);
}

function formatScoreline(match: NormalizedMatch) {
  if (match.score.home === null || match.score.away === null) return "-";
  return `${match.score.home}-${match.score.away}`;
}

function formatStatus(match: NormalizedMatch) {
  return formatMatchStatusLabel(match);
}

function formatStatusDescription(value: string) {
  const labels: Record<string, string> = {
    "Not started": "Başlamadı",
    "First half": "İlk yarı",
    "Second half": "İkinci yarı",
    "Half time": "Devre arası",
    "Extra time": "Uzatmalar",
    "Break time": "Ara",
    Penalties: "Penaltılar",
    Suspended: "Askıya alındı",
    Interrupted: "Kesintiye uğradı",
    "In progress": "Devam ediyor",
    Finished: "Bitti",
    "Finished after penalties": "Penaltılarla bitti",
    "Finished after extra time": "Uzatmalarda bitti",
    Postponed: "Ertelendi",
    "To be announced": "Açıklanacak",
    Cancelled: "İptal",
    Awarded: "Hükmen",
    Abandoned: "Yarıda kaldı",
    Unknown: "Bilinmiyor"
  };

  return labels[value] ?? value;
}

function formatRound(value: string) {
  const regular = value.match(/^Regular Season\s*-\s*(\d+)$/i);
  if (regular) return `Normal Sezon ${regular[1]}. Hafta`;

  const relegation = value.match(/^Relegation Group\s*-\s*(\d+)$/i);
  if (relegation) return `Düşme Grubu ${relegation[1]}. Hafta`;

  const championship = value.match(/^Championship Round\s*-\s*(\d+)$/i);
  if (championship) return `Şampiyonluk Turu ${championship[1]}. Hafta`;

  const labels: Record<string, string> = {
    "Semi-finals": "Yarı final",
    "Quarter-finals": "Çeyrek final",
    "Round of 16": "Son 16",
    "Group Stage": "Grup aşaması",
    "Preliminary Round": "Ön eleme turu",
    "Qualification Round": "Eleme turu",
    Final: "Final"
  };

  return labels[value] ?? value;
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

function formatShortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit"
  }).format(parsed);
}

function formatVenue(detail: MatchDetail | null) {
  const venue = detail?.venue;
  if (!venue) return null;
  return [venue.name, venue.city, localizeCountryName(venue.country)].filter(Boolean).join(" • ") || null;
}

function formatReferee(detail: MatchDetail | null) {
  const referee = detail?.referee;
  if (!referee) return null;
  return [referee.name, localizeCountryName(referee.nationality)].filter(Boolean).join(" • ") || null;
}

function formatForecast(detail: MatchDetail | null) {
  const forecast = detail?.forecast;
  if (!forecast) return null;
  const temperature = forecast.temperature !== null && forecast.temperature !== undefined ? `${forecast.temperature}°` : null;
  return [formatWeatherStatus(forecast.status), temperature].filter(Boolean).join(" • ") || null;
}

function formatWeatherStatus(value: string | null) {
  if (!value) return null;

  const labels: Record<string, string> = {
    clear: "Açık",
    Clear: "Açık",
    clouds: "Bulutlu",
    Clouds: "Bulutlu",
    cloudy: "Bulutlu",
    Cloudy: "Bulutlu",
    rain: "Yağmurlu",
    Rain: "Yağmurlu",
    snow: "Karlı",
    Snow: "Karlı",
    mist: "Puslu",
    Mist: "Puslu",
    fog: "Sisli",
    Fog: "Sisli",
    drizzle: "Çisenti",
    Drizzle: "Çisenti",
    thunderstorm: "Gök gürültülü",
    Thunderstorm: "Gök gürültülü"
  };

  return labels[value] ?? labels[value.toLowerCase()] ?? value;
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

function parsePercent(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}
