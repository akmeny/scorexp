import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  CloudSun,
  ListOrdered,
  MapPin,
  Moon,
  RefreshCw,
  Sparkles,
  Square,
  Sun,
  Target,
  Trophy,
  UserRound,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ComparisonMomentumChart } from "./ComparisonMomentumChart";
import { TeamLogo } from "./TeamLogo";
import { localizeCountryName } from "../lib/localization";
import { formatMatchStatusLabel } from "../lib/matchStatus";
import { translateStatisticLabel } from "../lib/statisticsLocalization";
import type {
  MatchDetail,
  MatchDetailEvent,
  MatchDetailPrediction,
  MatchDetailStatistic,
  MatchDetailStandingRow,
  MatchGoalHighlight,
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
  onOpenAtmosphere: () => void;
  colorMode?: "dark" | "light";
  onToggleColorMode?: () => void;
  goalHighlight?: MatchGoalHighlight | null;
  chatSlot?: ReactNode;
}

type DetailTab = "details" | "chat" | "events" | "stats" | "lineups" | "h2h" | "form" | "standings";
type AiStatus = "idle" | "analyzing" | "done";
type StatisticPeriod = "all" | "first" | "second";

interface StatisticRow {
  name: string;
  label: string;
  homeDisplay: string;
  awayDisplay: string;
  homeNumber: number;
  awayNumber: number;
  homePercent: number;
  awayPercent: number;
  period: StatisticPeriod;
}

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
  onReload,
  onOpenAtmosphere,
  colorMode = "dark",
  onToggleColorMode,
  goalHighlight = null,
  chatSlot
}: MatchDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>("details");
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiStep, setAiStep] = useState(0);
  const activeMatch = useMemo(() => syncLiveSnapshot(match, detail?.match), [detail?.match, match]);
  const activeGoalHighlight = activeMatch.status.group === "live" ? goalHighlight : null;
  const goalHeroClassName = [
    "detailScoreHero",
    activeGoalHighlight ? "goalScored" : "",
    activeGoalHighlight?.phase === "pending" ? "goalPending" : "",
    activeGoalHighlight?.phase === "confirmed" ? "goalConfirmed" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const prediction = detail?.predictions.latestLive ?? detail?.predictions.latestPrematch ?? null;
  const statisticRows = useMemo(() => buildStatisticRows(activeMatch, detail), [activeMatch, detail]);
  const hasChatTab = Boolean(chatSlot);
  const visibleTabs = useMemo(() => buildTabs(activeMatch, detail, statisticRows.length, hasChatTab), [activeMatch, detail, statisticRows.length, hasChatTab]);
  const aiResult = useMemo(() => buildAiResult(activeMatch, detail, prediction), [activeMatch, detail, prediction]);
  const tabStyle = { "--tab-count": visibleTabs.length } as CSSProperties;
  const ThemeIcon = colorMode === "dark" ? Sun : Moon;
  const themeToggleLabel = colorMode === "dark" ? "Açık moda geç" : "Koyu moda geç";

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
    const active = Boolean(chatSlot && tab === "chat");
    document.documentElement.classList.toggle("scorexpDetailChatActive", active);
    document.body.classList.toggle("scorexpDetailChatActive", active);

    return () => {
      document.documentElement.classList.remove("scorexpDetailChatActive");
      document.body.classList.remove("scorexpDetailChatActive");
    };
  }, [chatSlot, tab]);

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
    <aside className="matchDetailPane" aria-label="Maç detayı" data-active-tab={tab}>
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
          {onToggleColorMode ? (
            <button
              className="iconButton detailThemeButton themeHeaderIcon"
              type="button"
              aria-label={themeToggleLabel}
              aria-pressed={colorMode === "light"}
              title={themeToggleLabel}
              onClick={onToggleColorMode}
            >
              <ThemeIcon size={17} />
            </button>
          ) : null}
          <button className="iconButton" type="button" aria-label="Detayı yenile" onClick={onReload}>
            <RefreshCw className={refreshing ? "syncSpin" : undefined} size={17} />
          </button>
          <button className="iconButton" type="button" aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </header>

      <section className={goalHeroClassName}>
        {activeGoalHighlight ? <span className="detailGoalSweep" aria-hidden="true" /> : null}
        <TeamSummary match={activeMatch} side="home" goalActive={isGoalSide(activeGoalHighlight?.side ?? null, "home")} />
        <div className="detailScoreCenter">
          <strong>{formatScore(activeMatch.score.home, activeMatch.status.group === "upcoming")}</strong>
          <span>-</span>
          <strong>{formatScore(activeMatch.score.away, activeMatch.status.group === "upcoming")}</strong>
          <small>{formatStatus(activeMatch)}</small>
          {activeGoalHighlight ? <em className="detailGoalBadge">GOL</em> : null}
        </div>
        <TeamSummary match={activeMatch} side="away" goalActive={isGoalSide(activeGoalHighlight?.side ?? null, "away")} />
      </section>

      <div className="detailAtmosphereAction">
        <button className="detailAtmosphereButton" type="button" onClick={onOpenAtmosphere}>
          <Sparkles size={15} />
          <span>Maç Atmosferine Git</span>
        </button>
      </div>

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
            <DetailFact icon={<UserRound size={16} />} label="Hakem" value={formatReferee(detail)} />
          </div>

          <AiPredictionCard status={aiStatus} step={aiStep} result={aiResult} onStart={startAiPrediction} />

          <div className="detailFactGrid detailMetaFooter">
            <DetailFact icon={<CalendarClock size={16} />} label="Başlangıç" value={`${formatDate(activeMatch.date)} • ${activeMatch.localTime}`} />
            <DetailFact icon={<Trophy size={16} />} label="Lig" value={activeMatch.league.name} />
            <DetailFact icon={<MapPin size={16} />} label="Stat" value={formatVenue(detail)} />
            <DetailFact icon={<CloudSun size={16} />} label="Hava" value={formatForecast(detail)} />
            <DetailFact icon={<Activity size={16} />} label="Durum" value={formatStatusDescription(activeMatch.status.description)} />
            <DetailFact icon={<Target size={16} />} label="Tur" value={activeMatch.round ? formatRound(activeMatch.round) : null} />
          </div>
        </div>
      ) : null}

      {tab === "chat" && chatSlot ? <div className="detailContent detailChatContent">{chatSlot}</div> : null}

      {tab === "events" ? (
        <div className="detailContent detailEventContent">
          <div className="eventTimeline atmosphereTimeline detailEventTimeline">
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

      {tab === "lineups" ? (
        <div className="detailContent">
          <LineupsView match={activeMatch} lineups={detail?.lineups ?? null} />
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

function buildTabs(match: NormalizedMatch, detail: MatchDetail | null, statisticRowCount: number, hasChat: boolean) {
  const tabs: { key: DetailTab; label: string }[] = [{ key: "details", label: "Ayrıntılar" }];
  const isUpcoming = match.status.group === "upcoming";

  if (hasChat) tabs.push({ key: "chat", label: "Sohbet" });

  if (!isUpcoming && (detail?.events?.length ?? 0) > 0) tabs.push({ key: "events", label: "Özet" });
  if (!isUpcoming && statisticRowCount > 0) tabs.push({ key: "stats", label: "İstatistik" });
  if (detail?.lineups?.home || detail?.lineups?.away) tabs.push({ key: "lineups", label: "Kadrolar" });
  if ((detail?.headToHead?.length ?? 0) > 0) tabs.push({ key: "h2h", label: "Mukayese" });
  if ((detail?.form?.home.length ?? 0) > 0 || (detail?.form?.away.length ?? 0) > 0) tabs.push({ key: "form", label: "Form" });
  if ((detail?.standings?.groups.length ?? 0) > 0) tabs.push({ key: "standings", label: "Puan" });

  return tabs;
}

function syncLiveSnapshot(match: NormalizedMatch, detailMatch: NormalizedMatch | null | undefined) {
  if (!detailMatch) return match;

  return {
    ...detailMatch,
    date: match.date,
    localTime: match.localTime,
    timestamp: match.timestamp,
    status: match.status,
    score: match.score,
    redCards: match.redCards,
    lastUpdatedAt: match.lastUpdatedAt
  };
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

function TeamSummary({ match, side, goalActive = false }: { match: NormalizedMatch; side: "home" | "away"; goalActive?: boolean }) {
  const team = side === "home" ? match.homeTeam : match.awayTeam;

  return (
    <div className={`detailTeamSummary ${goalActive ? "goalTeam" : ""}`}>
      <TeamLogo src={team.logo} label={team.name} size="lg" />
      <span>{team.name}</span>
    </div>
  );
}

function isGoalSide(side: MatchGoalHighlight["side"] | null, target: "home" | "away") {
  return side === target || side === "both";
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
                <div className={item.key} key={item.label}>
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
  const eventTypeClass = eventClass(event.type);
  const description = eventDescription(event);

  return (
    <div className={`atmosphereTimelineItem detailEventItem ${side}`}>
      <span className="atmosphereTimelineMinute eventMinute">{event.time ? `${event.time}'` : "-"}</span>
      <article className={`atmosphereTimelineCard detailEventCard ${eventTypeClass}`}>
        <i className={`eventIcon ${eventTypeClass}`}>{eventIcon(event.type)}</i>
        <div>
          <strong>{eventLabels[event.type] ?? event.type}</strong>
          <p title={description}>{description}</p>
          <em title={event.team.name}>{event.team.name}</em>
        </div>
      </article>
    </div>
  );
}

function eventDescription(event: MatchDetailEvent) {
  return [event.player, event.assist ? `Asist: ${event.assist}` : null, event.substituted].filter(Boolean).join(" • ") || event.team.name;
}

function StatisticCompare({ match, rows }: { match: NormalizedMatch; rows: StatisticRow[] }) {
  const [activePeriod, setActivePeriod] = useState<StatisticPeriod>("all");
  const periodTabs = useMemo(() => buildStatisticPeriodTabs(rows), [rows]);
  const activeRows = periodTabs.find((tab) => tab.key === activePeriod)?.rows ?? [];

  useEffect(() => {
    if (!periodTabs.some((tab) => tab.key === activePeriod)) {
      setActivePeriod("all");
    }
  }, [activePeriod, periodTabs]);

  return (
    <div className="statCompareList">
      <div className="statPeriodTabs" role="tablist" aria-label="İstatistik periyodu">
        {periodTabs.map((tab) => (
          <button
            className={activePeriod === tab.key ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activePeriod === tab.key}
            onClick={() => setActivePeriod(tab.key)}
            key={tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="statTeams">
        <span>{match.homeTeam.name}</span>
        <BarChart3 size={16} />
        <span>{match.awayTeam.name}</span>
      </div>
      {activeRows.length > 0 ? (
        activeRows.map((row) => (
          <div className="statCompareRow" key={`${row.period}:${row.name}`}>
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
        ))
      ) : (
        <div className="detailEmptyState">{periodTabs.find((tab) => tab.key === activePeriod)?.label ?? "Periyot"} ayrımı sağlayıcıda yok</div>
      )}
    </div>
  );
}

function HeadToHeadView({ match, matches }: { match: NormalizedMatch; matches: NormalizedMatch[] }) {
  const pastMatches = matches.filter((item) => item.id !== match.id);
  const summary = summarizeResults(pastMatches, match.homeTeam, match.awayTeam);
  const items = [
    { label: match.homeTeam.name, shortLabel: "Ev", value: summary.homeWins, suffix: "G", tone: "home" },
    { label: "Beraberlik", shortLabel: "X", value: summary.draws, suffix: "B", tone: "draw" },
    { label: match.awayTeam.name, shortLabel: "Dep", value: summary.awayWins, suffix: "G", tone: "away" }
  ] as const;

  return (
    <div className="h2hBlock">
      <ComparisonMomentumChart items={items} />
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
    <div className="formDetailStack">
      <FormGoalsGraph homeTeam={match.homeTeam} awayTeam={match.awayTeam} homeMatches={homeForm} awayMatches={awayForm} />
      <div className="formGrid">
        <TeamFormColumn team={match.homeTeam} matches={homeForm} />
        <TeamFormColumn team={match.awayTeam} matches={awayForm} />
      </div>
    </div>
  );
}

function FormGoalsGraph({
  homeTeam,
  awayTeam,
  homeMatches,
  awayMatches
}: {
  homeTeam: Team;
  awayTeam: Team;
  homeMatches: NormalizedMatch[];
  awayMatches: NormalizedMatch[];
}) {
  const home = formGoalTotals(homeMatches, homeTeam.id);
  const away = formGoalTotals(awayMatches, awayTeam.id);

  if (home.played === 0 && away.played === 0) {
    return <div className="detailEmptyState">Form gol grafiği için veri bekleniyor</div>;
  }

  return (
    <div className="formGoalsGraph detailFormGoalsGraph" aria-label="Son 5 maç gol formu">
      <div className="formGoalsHeader">
        <span>Son 5 Maç Gol Formu</span>
        <div className="formGoalsTeams">
          <strong title={homeTeam.name}>{homeTeam.name}</strong>
          <em>Son 5 maç toplamları</em>
          <strong title={awayTeam.name}>{awayTeam.name}</strong>
        </div>
        <div className="formGoalsTotals" aria-hidden="true">
          <b>
            <span>Attı</span>
            {home.scored}
          </b>
          <b>
            <span>Yedi</span>
            {home.conceded}
          </b>
          <b>
            <span>Attı</span>
            {away.scored}
          </b>
          <b>
            <span>Yedi</span>
            {away.conceded}
          </b>
        </div>
      </div>
      <div className="formGoalsBars">
        <FormGoalBar label="Attığı gol" home={home.scored} away={away.scored} />
        <FormGoalBar label="Yediği gol" home={home.conceded} away={away.conceded} reverseTone />
      </div>
    </div>
  );
}

function FormGoalBar({ label, home, away, reverseTone = false }: { label: string; home: number; away: number; reverseTone?: boolean }) {
  const homeShare = shareOfTotal(home, away) * 100;
  const awayShare = 100 - homeShare;
  const leaderClass = home === away ? "balanced" : home > away ? "homeLead" : "awayLead";

  return (
    <div className={`formGoalBar ${reverseTone ? "reverseTone" : ""} ${leaderClass}`}>
      <div className="formGoalBarMeta">
        <span>{label}</span>
        <em>{home === away ? "Denge" : home > away ? "Ev yüksek" : "Dep yüksek"}</em>
      </div>
      <div className="formGoalBarBody">
        <strong>{home}</strong>
        <div className="formGoalBarTrack">
          <i style={{ width: `${homeShare}%` }} />
          <b style={{ width: `${awayShare}%` }} />
        </div>
        <strong>{away}</strong>
      </div>
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

function LineupsView({ match, lineups }: { match: NormalizedMatch; lineups: MatchDetail["lineups"] }) {
  if (!lineups?.home && !lineups?.away) return null;

  return (
    <div className="lineupsBlock">
      <LineupTeamColumn fallbackTeam={match.homeTeam} lineup={lineups.home} />
      <LineupTeamColumn fallbackTeam={match.awayTeam} lineup={lineups.away} />
    </div>
  );
}

function LineupTeamColumn({ fallbackTeam, lineup }: { fallbackTeam: Team; lineup: NonNullable<MatchDetail["lineups"]>["home"] }) {
  const team = lineup?.team ?? fallbackTeam;
  const starters = lineup?.initialLineup.flat() ?? [];
  const substitutes = lineup?.substitutes ?? [];

  return (
    <section className="lineupTeamColumn">
      <div className="lineupTeamHeader">
        <TeamLogo src={team.logo} label={team.name} size="sm" />
        <div>
          <strong>{team.name}</strong>
          <span>{lineup?.formation ?? "Diziliş bekleniyor"}</span>
        </div>
      </div>

      <div className="lineupPitch">
        {(lineup?.initialLineup ?? []).map((row, index) => (
          <div className="lineupPitchRow" key={`${team.id}:row:${index}`}>
            {row.map((player, playerIndex) => (
              <PlayerPill player={player} key={`${player.id ?? player.name}:${playerIndex}`} />
            ))}
          </div>
        ))}
        {starters.length === 0 ? <em>Kadro verisi bekleniyor</em> : null}
      </div>

      {substitutes.length > 0 ? (
        <div className="lineupBench">
          <span>Yedekler</span>
          <div>
            {substitutes.slice(0, 9).map((player, index) => (
              <PlayerPill player={player} compact key={`${player.id ?? player.name}:sub:${index}`} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PlayerPill({
  player,
  compact = false
}: {
  player: NonNullable<NonNullable<MatchDetail["lineups"]>["home"]>["substitutes"][number];
  compact?: boolean;
}) {
  return (
    <span className={`lineupPlayerPill ${compact ? "compact" : ""}`} title={player.position ?? player.name}>
      {player.number !== null ? <b>{player.number}</b> : null}
      <em>{player.name}</em>
    </span>
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
  const focusAway = match.awayTeam.id === focusTeamId;

  return (
    <div className={`compactMatchRow ${focusHome ? "focusHome" : focusAway ? "focusAway" : ""}`}>
      <span>{formatShortDate(match.date)}</span>
      <span className="compactMatchTeams">
        <TeamLogo src={match.homeTeam.logo} label={match.homeTeam.name} size="sm" />
        <strong title={`${match.homeTeam.name} - ${match.awayTeam.name}`}>
          {match.homeTeam.name} - {match.awayTeam.name}
        </strong>
      </span>
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

function buildStatisticRows(match: NormalizedMatch, detail: MatchDetail | null): StatisticRow[] {
  const home = normalizeStatisticEntries(detail?.statistics?.find((group) => group.team.id === match.homeTeam.id)?.statistics ?? []);
  const away = normalizeStatisticEntries(detail?.statistics?.find((group) => group.team.id === match.awayTeam.id)?.statistics ?? []);
  const homeMap = new Map(home.map((item) => [statisticKey(item.period, item.name), item]));
  const awayMap = new Map(away.map((item) => [statisticKey(item.period, item.name), item]));
  const preferredKeys = statisticPriority.map((name) => statisticKey("all", name));
  const keys = Array.from(new Set([...preferredKeys, ...home.map((item) => statisticKey(item.period, item.name)), ...away.map((item) => statisticKey(item.period, item.name))]));

  return keys
    .filter((key) => homeMap.has(key) || awayMap.has(key))
    .map((key) => {
      const [period, name] = splitStatisticKey(key);
      const homeValue = homeMap.get(key)?.value ?? null;
      const awayValue = awayMap.get(key)?.value ?? null;
      return createStatisticRow(period, name, homeValue, awayValue);
    });
}

function normalizeStatisticEntries(statistics: MatchDetailStatistic[]) {
  return statistics.map((item) => {
    const parsed = parseStatisticPeriod(item.displayName, item.period);
    return {
      name: parsed.name,
      period: parsed.period,
      value: item.value
    };
  });
}

function parseStatisticPeriod(displayName: string, explicitPeriod?: string | number | null): { name: string; period: StatisticPeriod } {
  const normalized = normalizeStatisticLookup(`${explicitPeriod ?? ""} ${displayName}`);
  const explicit = parseExplicitStatisticPeriod(explicitPeriod);
  const firstHalfPattern = /\b(1st|first|1h|1\.|ilk)\s*(half|period|yarı|yari)?\b|\b(first half|ilk yarı|ilk yari)\b/i;
  const secondHalfPattern = /\b(2nd|second|2h|2\.|ikinci)\s*(half|period|yarı|yari)?\b|\b(second half|ikinci yarı|ikinci yari)\b/i;
  const period: StatisticPeriod = explicit ?? (secondHalfPattern.test(normalized) ? "second" : firstHalfPattern.test(normalized) ? "first" : "all");
  const name =
    displayName
      .replace(/\b(1st|first|1h|1\.|ilk)\s*(half|period|yarı|yari)?\b/gi, "")
      .replace(/\b(2nd|second|2h|2\.|ikinci)\s*(half|period|yarı|yari)?\b/gi, "")
      .replace(/\b(first half|second half|ilk yarı|ilk yari|ikinci yarı|ikinci yari)\b/gi, "")
      .replace(/^[\s:|/.-]+|[\s:|/.-]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() || displayName;

  return { name, period };
}

function parseExplicitStatisticPeriod(value: string | number | null | undefined): StatisticPeriod | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = normalizeStatisticLookup(String(value));
  if (/^(1|1h|h1|first|first half|ilk|ilk yari|ilk yarı)$/.test(normalized)) return "first";
  if (/^(2|2h|h2|second|second half|ikinci|ikinci yari|ikinci yarı)$/.test(normalized)) return "second";
  if (/^(all|full|full time|match|total|tamami|tamamı)$/.test(normalized)) return "all";
  return null;
}

function createStatisticRow(period: StatisticPeriod, name: string, homeValue: MatchDetailStatistic["value"], awayValue: MatchDetailStatistic["value"]): StatisticRow {
  const homeNumber = comparableStatValue(name, homeValue);
  const awayNumber = comparableStatValue(name, awayValue);
  const total = Math.max(homeNumber + awayNumber, 0);

  return {
    name,
    label: translateStatisticLabel(name),
    homeDisplay: formatStatValue(name, homeValue),
    awayDisplay: formatStatValue(name, awayValue),
    homeNumber,
    awayNumber,
    homePercent: total > 0 ? Math.max(6, (homeNumber / total) * 100) : 50,
    awayPercent: total > 0 ? Math.max(6, (awayNumber / total) * 100) : 50,
    period
  };
}

function buildStatisticPeriodTabs(rows: StatisticRow[]) {
  const firstRows = rows.filter((row) => row.period === "first");
  const secondRows = rows.filter((row) => row.period === "second");
  const allRows = rows.filter((row) => row.period === "all");
  const fullRows = allRows.length > 0 ? allRows : mergePeriodStatisticRows(firstRows, secondRows);

  return [
    { key: "all" as const, label: "Tamamı", rows: fullRows },
    { key: "first" as const, label: "İlk Yarı", rows: firstRows },
    { key: "second" as const, label: "İkinci Yarı", rows: secondRows }
  ];
}

function mergePeriodStatisticRows(firstRows: StatisticRow[], secondRows: StatisticRow[]) {
  const byName = new Map<string, { first?: StatisticRow; second?: StatisticRow }>();
  for (const row of firstRows) byName.set(row.name, { ...byName.get(row.name), first: row });
  for (const row of secondRows) byName.set(row.name, { ...byName.get(row.name), second: row });

  return Array.from(byName.entries()).map(([name, pair]) => {
    const homeNumber = (pair.first?.homeNumber ?? 0) + (pair.second?.homeNumber ?? 0);
    const awayNumber = (pair.first?.awayNumber ?? 0) + (pair.second?.awayNumber ?? 0);
    return createStatisticRow("all", name, homeNumber, awayNumber);
  });
}

function statisticKey(period: StatisticPeriod, name: string) {
  return `${period}:${name}`;
}

function splitStatisticKey(key: string): [StatisticPeriod, string] {
  const [period, ...nameParts] = key.split(":");
  return [(period === "first" || period === "second" ? period : "all") as StatisticPeriod, nameParts.join(":")];
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
      probabilities: probabilities.map((item) => ({
        key: item.key,
        label: item.key === "home" ? "1" : item.key === "draw" ? "X" : "2",
        value: item.value ?? "0%"
      }))
    };
  }

  return {
    title: "Tahmin üretilemedi",
    summary: "aiXp Tahmin Simülasyonu veri yetersizliği nedeniyle bu maç için tahmin üretmemiştir.",
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
  if (type.includes("Substitution")) return "substitution";
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

function formGoalTotals(matches: NormalizedMatch[], teamId: string) {
  return matches.slice(0, 5).reduce(
    (total, match) => {
      if (match.score.home === null || match.score.away === null) return total;
      const isHome = match.homeTeam.id === teamId;
      const isAway = match.awayTeam.id === teamId;
      if (!isHome && !isAway) return total;

      return {
        played: total.played + 1,
        scored: total.scored + (isHome ? match.score.home ?? 0 : match.score.away ?? 0),
        conceded: total.conceded + (isHome ? match.score.away ?? 0 : match.score.home ?? 0)
      };
    },
    { played: 0, scored: 0, conceded: 0 }
  );
}

function shareOfTotal(home: number, away: number) {
  const total = home + away;
  if (!Number.isFinite(total) || total <= 0) return 0.5;
  return Math.min(1, Math.max(0, home / total));
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

function normalizeStatisticLookup(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ");
}

function parsePercent(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}
