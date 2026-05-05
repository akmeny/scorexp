import {
  Activity,
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  CloudSun,
  Gauge,
  ListOrdered,
  MapPin,
  MessageCircle,
  Moon,
  RefreshCw,
  Shield,
  Sparkles,
  Sun,
  Target,
  Trophy,
  UsersRound,
  X,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MatchChatRoom } from "./MatchChatRoom";
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
  MatchDetailTopPlayer,
  NormalizedMatch,
  Team
} from "../types";

interface MatchAtmosphereOverlayProps {
  match: NormalizedMatch;
  detail: MatchDetail | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRequestClose: () => void;
  onReload: () => void;
  colorMode?: "dark" | "light";
  onToggleColorMode?: () => void;
  backLabel?: string;
}

const statisticPriority = [
  "Possession",
  "Shots on target",
  "Shots off target",
  "Total shots",
  "Corners",
  "Free Kicks",
  "Offsides",
  "Fouls",
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

type AtmosphereTab = "overview" | "chat";

export function MatchAtmosphereOverlay({
  match,
  detail,
  loading,
  refreshing,
  error,
  onRequestClose,
  onReload,
  colorMode = "dark",
  onToggleColorMode,
  backLabel = "Maç listesi"
}: MatchAtmosphereOverlayProps) {
  const [activeTab, setActiveTab] = useState<AtmosphereTab>("overview");
  const activeMatch = useMemo(() => syncLiveSnapshot(match, detail?.match), [detail?.match, match]);
  const prediction = detail?.predictions.latestLive ?? detail?.predictions.latestPrematch ?? null;
  const statisticRows = useMemo(() => buildStatisticRows(activeMatch, detail), [activeMatch, detail]);
  const predictionRows = useMemo(() => buildPredictionRows(activeMatch, prediction), [activeMatch, prediction]);
  const aiSummary = useMemo(() => buildAiSummary(activeMatch, predictionRows), [activeMatch, predictionRows]);
  const insightRows = useMemo(() => buildInsightRows(activeMatch, detail, statisticRows, predictionRows), [activeMatch, detail, statisticRows, predictionRows]);
  const h2hMatches = useMemo(() => (detail?.headToHead ?? []).filter((item) => item.id !== activeMatch.id), [activeMatch.id, detail?.headToHead]);
  const h2hSummary = useMemo(() => summarizeResults(h2hMatches, activeMatch.homeTeam, activeMatch.awayTeam), [activeMatch, h2hMatches]);
  const homeStanding = useMemo(() => findStandingRow(detail?.standings ?? null, activeMatch.homeTeam.id), [activeMatch.homeTeam.id, detail?.standings]);
  const awayStanding = useMemo(() => findStandingRow(detail?.standings ?? null, activeMatch.awayTeam.id), [activeMatch.awayTeam.id, detail?.standings]);
  const ThemeIcon = colorMode === "dark" ? Sun : Moon;
  const themeToggleLabel = colorMode === "dark" ? "Açık moda geç" : "Koyu moda geç";

  useEffect(() => {
    setActiveTab("overview");
  }, [match.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onRequestClose();
    };

    const shouldLockDocumentScroll = window.matchMedia("(min-width: 981px)").matches;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    if (shouldLockDocumentScroll) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      if (shouldLockDocumentScroll) {
        document.body.style.overflow = bodyOverflow;
        document.documentElement.style.overflow = htmlOverflow;
      }
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onRequestClose]);

  const selectAtmosphereTab = (nextTab: AtmosphereTab, targetId?: string) => {
    setActiveTab(nextTab);

    if (!targetId) return;

    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
    });
  };

  const shellClassName = [
    "matchAtmosphereShell",
    activeMatch.status.group,
    activeTab === "chat" ? "chatTabActive" : "overviewTabActive"
  ].join(" ");

  return (
    <div className="matchAtmosphereOverlay" role="dialog" aria-modal="true" aria-label="Maç atmosferi">
      <section className={shellClassName}>
        <header className="atmosphereTopbar">
          <button className="atmosphereBackButton" type="button" onClick={onRequestClose}>
            <ArrowLeft size={17} />
            <span>{backLabel}</span>
          </button>

          <div className="atmosphereLeagueTitle">
            <span>{localizeCountryName(activeMatch.country.name)}</span>
            <strong title={activeMatch.league.name}>{activeMatch.league.name}</strong>
            {activeMatch.round ? <em>{formatRound(activeMatch.round)}</em> : null}
          </div>

          <div className="atmosphereTopActions">
            {onToggleColorMode ? (
              <button
                className="atmosphereThemeButton themeHeaderIcon"
                type="button"
                aria-label={themeToggleLabel}
                aria-pressed={colorMode === "light"}
                title={themeToggleLabel}
                onClick={onToggleColorMode}
              >
                <ThemeIcon size={17} />
              </button>
            ) : null}
            <button type="button" aria-label="Atmosferi yenile" onClick={onReload}>
              <RefreshCw className={refreshing ? "syncSpin" : undefined} size={17} />
            </button>
            <button type="button" aria-label="Kapat" onClick={onRequestClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="atmosphereBody">
          <aside className="atmosphereRail" aria-label="Maç atmosferi bölümleri">
            <div className="atmosphereBrand">
              <span className="brandMark">S</span>
              <div>
                <strong>ScoreXP</strong>
                <span>Maç Atmosferi</span>
              </div>
            </div>
            <nav aria-label="Maç atmosferi bölümleri">
              <button
                className={activeTab === "overview" ? "active" : ""}
                type="button"
                onClick={() => selectAtmosphereTab("overview", "atmosphere-overview")}
              >
                Özet
              </button>
              <button
                className={activeTab === "chat" ? "active" : ""}
                type="button"
                onClick={() => selectAtmosphereTab("chat", "atmosphere-chat")}
              >
                Sohbet
              </button>
              <button type="button" onClick={() => selectAtmosphereTab("overview", "atmosphere-ai")}>
                aiXp
              </button>
              <button type="button" onClick={() => selectAtmosphereTab("overview", "atmosphere-data")}>
                Veri
              </button>
              <button type="button" onClick={() => selectAtmosphereTab("overview", "atmosphere-history")}>
                Geçmiş
              </button>
              <button type="button" onClick={() => selectAtmosphereTab("overview", "atmosphere-players")}>
                Oyuncu
              </button>
            </nav>
            <div className="atmosphereRailMetric">
              <Activity size={15} />
              <span>{formatStatus(activeMatch)}</span>
            </div>
            <div className="atmosphereRailMetric">
              <Gauge size={15} />
              <span>{formatRefreshLabel(detail)}</span>
            </div>
          </aside>

          <main className="atmosphereScroll">
            <section className="atmosphereHero" id="atmosphere-overview">
              <AtmosphereTeam team={activeMatch.homeTeam} side="home" standing={homeStanding} form={detail?.form?.home ?? []} />
              <div className="atmosphereScoreStage">
                <span className={`atmosphereStatusPill ${activeMatch.status.group}`}>{formatStatus(activeMatch)}</span>
                <div className="atmosphereScoreline">{formatScoreline(activeMatch)}</div>
                <strong>Maç Atmosferi</strong>
                <p>{atmosphereSummary(activeMatch)}</p>
              </div>
              <AtmosphereTeam team={activeMatch.awayTeam} side="away" standing={awayStanding} form={detail?.form?.away ?? []} />
            </section>

            <nav className="atmosphereTabs" aria-label="Maç atmosferi sekmeleri">
              <button
                className={activeTab === "overview" ? "active" : ""}
                type="button"
                aria-selected={activeTab === "overview"}
                onClick={() => selectAtmosphereTab("overview", "atmosphere-overview")}
              >
                Genel Bakış
              </button>
              <button
                className={activeTab === "chat" ? "active" : ""}
                type="button"
                aria-selected={activeTab === "chat"}
                onClick={() => selectAtmosphereTab("chat", "atmosphere-chat")}
              >
                Sohbet
              </button>
            </nav>

            {loading ? <div className="atmosphereNotice atmosphereOverviewOnly">Detay verileri yükleniyor</div> : null}
            {error ? <div className="atmosphereNotice error atmosphereOverviewOnly">{error}</div> : null}

            <section className="atmosphereSignalStrip atmosphereOverviewOnly" aria-label="Maç sinyalleri">
              <SignalMetric icon={<CalendarClock size={16} />} label="Başlangıç" value={`${formatDate(activeMatch.date)} • ${activeMatch.localTime}`} />
              <SignalMetric icon={<MapPin size={16} />} label="Stat" value={formatVenue(detail) ?? "Veri yok"} />
              <SignalMetric icon={<CloudSun size={16} />} label="Hava" value={formatForecast(detail) ?? "Veri yok"} />
              <SignalMetric icon={<Trophy size={16} />} label="Lig" value={activeMatch.league.name} />
            </section>

            <section className="atmosphereChatSection atmosphereChatOnly" id="atmosphere-chat">
              <PanelTitle icon={<MessageCircle size={17} />} label="Sohbet" />
              <MatchChatRoom match={activeMatch} variant="embedded" />
            </section>

            <section className="atmosphereGrid atmosphereOverviewOnly">
              <section className="atmospherePanel atmosphereAiPanel" id="atmosphere-ai">
                <PanelTitle icon={<BrainCircuit size={17} />} label="aiXp Analizi" />
                <strong>{aiSummary.title}</strong>
                <p>{aiSummary.summary}</p>
                {predictionRows.length > 0 ? (
                  <div className="atmosphereProbabilityBars">
                    {predictionRows.map((item) => (
                      <div key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <i style={{ width: item.value }} />
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="atmospherePanel">
                <PanelTitle icon={<Sparkles size={17} />} label="Karar Sinyalleri" />
                <div className="atmosphereInsightList">
                  {insightRows.map((item) => (
                    <div className="atmosphereInsight" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <p>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            </section>

            <section className="atmospherePanel atmosphereOverviewOnly" id="atmosphere-data">
              <PanelTitle icon={<BarChart3 size={17} />} label={activeMatch.status.group === "upcoming" ? "Ön Maç Veri Dengesi" : "Maç İstatistikleri"} />
              <StatisticCompare match={activeMatch} rows={statisticRows} />
            </section>

            <section className="atmosphereTwinGrid atmosphereOverviewOnly" id="atmosphere-history">
              <section className="atmospherePanel">
                <PanelTitle icon={<Shield size={17} />} label="Form ve Aralar" />
                <div className="atmosphereHistorySummary">
                  <SummaryMetric label={activeMatch.homeTeam.name} value={`${h2hSummary.homeWins}G`} />
                  <SummaryMetric label="Beraberlik" value={`${h2hSummary.draws}B`} />
                  <SummaryMetric label={activeMatch.awayTeam.name} value={`${h2hSummary.awayWins}G`} />
                </div>
                <div className="atmosphereFormGrid">
                  <FormColumn team={activeMatch.homeTeam} matches={detail?.form?.home ?? []} />
                  <FormColumn team={activeMatch.awayTeam} matches={detail?.form?.away ?? []} />
                </div>
                <RecentHeadToHead matches={h2hMatches} focusTeamId={activeMatch.homeTeam.id} />
              </section>

              <section className="atmospherePanel">
                <PanelTitle icon={<ListOrdered size={17} />} label="Puan ve Konum" />
                <StandingSnapshot
                  standings={detail?.standings ?? null}
                  homeTeamId={activeMatch.homeTeam.id}
                  awayTeamId={activeMatch.awayTeam.id}
                />
              </section>
            </section>

            <section className="atmospherePanel atmosphereOverviewOnly" id="atmosphere-players">
              <PanelTitle icon={<UsersRound size={17} />} label="Oyuncu Profilleri" />
              <div className="atmospherePlayerGrid">
                <PlayerColumn team={activeMatch.homeTeam} players={detail?.topPlayers.home ?? []} />
                <PlayerColumn team={activeMatch.awayTeam} players={detail?.topPlayers.away ?? []} />
              </div>
            </section>

            <section className="atmospherePanel atmosphereOverviewOnly">
              <PanelTitle icon={<Zap size={17} />} label={activeMatch.status.group === "upcoming" ? "Maç Öncesi Akış" : "Maç Akışı"} />
              <EventTimeline events={detail?.events ?? []} match={activeMatch} />
            </section>
          </main>
        </div>
      </section>
    </div>
  );
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

function AtmosphereTeam({
  team,
  side,
  standing,
  form
}: {
  team: Team;
  side: "home" | "away";
  standing: MatchDetailStandingRow | null;
  form: NormalizedMatch[];
}) {
  return (
    <div className={`atmosphereTeam ${side}`}>
      <TeamLogo src={team.logo} label={team.name} size="lg" />
      <strong title={team.name}>{team.name}</strong>
      <span>{standing?.position ? `${standing.position}. sıra` : `${formScore(form, team.id)} form puanı`}</span>
    </div>
  );
}

function PanelTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="atmospherePanelTitle">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function SignalMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="atmosphereSignalMetric">
      {icon}
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="atmosphereSummaryMetric">
      <span title={label}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatisticCompare({ match, rows }: { match: NormalizedMatch; rows: ReturnType<typeof buildStatisticRows> }) {
  if (rows.length === 0) {
    return <EmptyAtmosphereState label="İstatistik verisi bekleniyor" />;
  }

  return (
    <div className="atmosphereStatList">
      <div className="atmosphereStatTeams">
        <span title={match.homeTeam.name}>{match.homeTeam.name}</span>
        <BarChart3 size={16} />
        <span title={match.awayTeam.name}>{match.awayTeam.name}</span>
      </div>
      {rows.slice(0, 14).map((row) => (
        <div className="atmosphereStatRow" key={row.name}>
          <div className="atmosphereStatValues">
            <strong>{row.homeDisplay}</strong>
            <span>{row.label}</span>
            <strong>{row.awayDisplay}</strong>
          </div>
          <div className="atmosphereStatBars" aria-hidden="true">
            <i style={{ width: `${row.homePercent}%` }} />
            <b style={{ width: `${row.awayPercent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FormColumn({ team, matches }: { team: Team; matches: NormalizedMatch[] }) {
  return (
    <div className="atmosphereFormColumn">
      <div className="atmosphereFormTitle">
        <TeamLogo src={team.logo} label={team.name} size="sm" />
        <span title={team.name}>{team.name}</span>
      </div>
      <div className="atmosphereFormChips">
        {matches.slice(0, 6).map((match) => {
          const outcome = resultForTeam(match, team.id);
          return (
            <span className={`formChip ${outcome}`} key={match.id}>
              {outcomeLabel(outcome)}
            </span>
          );
        })}
        {matches.length === 0 ? <em>Veri yok</em> : null}
      </div>
      <div className="atmosphereMiniList">
        {matches.slice(0, 4).map((match) => (
          <MiniMatchRow key={match.id} match={match} focusTeamId={team.id} />
        ))}
      </div>
    </div>
  );
}

function MiniMatchRow({ match, focusTeamId }: { match: NormalizedMatch; focusTeamId: string }) {
  const focusHome = match.homeTeam.id === focusTeamId;
  const opponent = focusHome ? match.awayTeam : match.homeTeam;

  return (
    <div className="atmosphereMiniRow">
      <span>{formatShortDate(match.date)}</span>
      <TeamLogo src={opponent.logo} label={opponent.name} size="sm" />
      <strong title={opponent.name}>{opponent.name}</strong>
      <b>{formatScoreline(match)}</b>
    </div>
  );
}

function RecentHeadToHead({ matches, focusTeamId }: { matches: NormalizedMatch[]; focusTeamId: string }) {
  if (matches.length === 0) return null;

  return (
    <div className="atmosphereHeadToHeadList">
      <span>Son karşılaşmalar</span>
      <div className="atmosphereMiniList">
        {matches.slice(0, 5).map((match) => (
          <MiniMatchRow key={match.id} match={match} focusTeamId={focusTeamId} />
        ))}
      </div>
    </div>
  );
}

function StandingSnapshot({
  standings,
  homeTeamId,
  awayTeamId
}: {
  standings: MatchDetail["standings"];
  homeTeamId: string;
  awayTeamId: string;
}) {
  const rows = buildStandingWindow(standings, homeTeamId, awayTeamId);
  if (rows.length === 0) return <EmptyAtmosphereState label="Puan verisi bekleniyor" />;

  return (
    <div className="atmosphereStandingTable">
      <div className="atmosphereStandingHead">
        <span>#</span>
        <span>Takım</span>
        <span>O</span>
        <span>AV</span>
        <span>P</span>
      </div>
      {rows.map((row) => (
        <div
          className={`atmosphereStandingRow ${row.team.id === homeTeamId || row.team.id === awayTeamId ? "highlighted" : ""}`}
          key={row.team.id}
        >
          <span>{row.position ?? "-"}</span>
          <TeamLogo src={row.team.logo} label={row.team.name} size="sm" />
          <strong title={row.team.name}>{row.team.name}</strong>
          <em>{row.total.games}</em>
          <em>{formatGoalDifference(row)}</em>
          <b>{row.points ?? "-"}</b>
        </div>
      ))}
    </div>
  );
}

function PlayerColumn({ team, players }: { team: Team; players: MatchDetailTopPlayer[] }) {
  return (
    <div className="atmospherePlayerColumn">
      <div className="atmospherePlayerTeam">
        <TeamLogo src={team.logo} label={team.name} size="sm" />
        <span title={team.name}>{team.name}</span>
      </div>
      {players.length > 0 ? (
        <div className="atmospherePlayerList">
          {players.slice(0, 5).map((player) => (
            <div className="atmospherePlayerRow" key={`${team.id}:${player.name}`}>
              <strong title={player.name}>{player.name}</strong>
              <span>{player.position ?? "Oyuncu"}</span>
              <b>{formatPlayerStat(player)}</b>
            </div>
          ))}
        </div>
      ) : (
        <EmptyAtmosphereState label="Oyuncu verisi bekleniyor" />
      )}
    </div>
  );
}

function EventTimeline({ events, match }: { events: MatchDetailEvent[]; match: NormalizedMatch }) {
  if (events.length === 0) {
    return <EmptyAtmosphereState label={match.status.group === "upcoming" ? "Maç akışı başlangıçta açılacak" : "Maç akışı verisi bekleniyor"} />;
  }

  return (
    <div className="atmosphereTimeline">
      {events.map((event, index) => {
        const side = eventSide(event, match);

        return (
          <div className={`atmosphereTimelineItem ${side}`} key={`${event.time ?? "na"}:${event.type}:${event.team.id}:${index}`}>
            <span className="atmosphereTimelineMinute">{event.time ? `${event.time}'` : "-"}</span>
            <article className={`atmosphereTimelineCard ${eventClass(event.type)}`}>
              <i>{eventIcon(event.type)}</i>
              <div>
                <strong>{eventLabels[event.type] ?? event.type}</strong>
                <p title={eventDescription(event)}>{eventDescription(event)}</p>
                <em title={event.team.name}>{event.team.name}</em>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}

function eventDescription(event: MatchDetailEvent) {
  return [event.player, event.assist ? `Asist: ${event.assist}` : null, event.substituted].filter(Boolean).join(" / ") || event.team.name;
}

function EmptyAtmosphereState({ label }: { label: string }) {
  return (
    <div className="atmosphereEmptyState">
      <Target size={16} />
      <span>{label}</span>
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
        label: translateStatisticLabel(name),
        homeDisplay: formatStatValue(name, homeValue),
        awayDisplay: formatStatValue(name, awayValue),
        homeNumber,
        awayNumber,
        homePercent: total > 0 ? Math.max(6, (homeNumber / total) * 100) : 50,
        awayPercent: total > 0 ? Math.max(6, (awayNumber / total) * 100) : 50
      };
    });
}

function buildPredictionRows(match: NormalizedMatch, prediction: MatchDetailPrediction | null) {
  if (!prediction) return [];

  return [
    { key: "home", label: "1", team: match.homeTeam.name, value: prediction.probabilities.home },
    { key: "draw", label: "X", team: "Beraberlik", value: prediction.probabilities.draw },
    { key: "away", label: "2", team: match.awayTeam.name, value: prediction.probabilities.away }
  ]
    .map((item) => ({ ...item, number: parsePercent(item.value) }))
    .filter((item): item is { key: string; label: string; team: string; value: string; number: number } => item.number !== null && item.value !== null);
}

function buildAiSummary(match: NormalizedMatch, rows: ReturnType<typeof buildPredictionRows>) {
  if (rows.length === 0) {
    return {
      title: "aiXp veri seti bekleniyor",
      summary: "Bu maç için tahmin olasılıkları henüz üretilmedi; form, puan ve akış verileri geldikçe atmosfer paneli karar sinyallerini günceller."
    };
  }

  const sorted = [...rows].sort((a, b) => b.number - a.number);
  const leader = sorted[0];
  const runner = sorted[1];
  const spread = runner ? leader.number - runner.number : leader.number;
  const confidence = spread >= 14 ? "yüksek" : spread >= 7 ? "orta" : "dengeli";
  const phase = match.status.group === "live" ? "canlı akışla" : match.status.group === "finished" ? "maç sonrası veriyle" : "maç öncesi veriyle";

  return {
    title: `${leader.team} öne çıkıyor`,
    summary: `aiXp ${phase} ${leader.team} tarafını ${leader.value} seviyesinde görüyor. Güven seviyesi ${confidence}; olasılık farkı ${Math.round(spread)} puan.`
  };
}

function buildInsightRows(
  match: NormalizedMatch,
  detail: MatchDetail | null,
  stats: ReturnType<typeof buildStatisticRows>,
  predictions: ReturnType<typeof buildPredictionRows>
) {
  const homeFormScore = formScore(detail?.form?.home ?? [], match.homeTeam.id);
  const awayFormScore = formScore(detail?.form?.away ?? [], match.awayTeam.id);
  const h2h = summarizeResults((detail?.headToHead ?? []).filter((item) => item.id !== match.id), match.homeTeam, match.awayTeam);
  const shots = stats.find((row) => row.name === "Shots on target") ?? stats.find((row) => row.name === "Total shots");
  const leader = predictions.length > 0 ? [...predictions].sort((a, b) => b.number - a.number)[0] : null;

  return [
    {
      label: "Durum",
      value: formatStatus(match),
      detail: match.status.group === "live" ? "Canlı veri ritmi açık" : match.status.group === "finished" ? "Maç sonrası analiz görünümü" : "Maç öncesi hazırlık görünümü"
    },
    {
      label: "Form",
      value: `${homeFormScore} - ${awayFormScore}`,
      detail: homeFormScore === awayFormScore ? "Son maç formu dengede" : `${homeFormScore > awayFormScore ? match.homeTeam.name : match.awayTeam.name} son maçlarda daha yüksek puan topladı`
    },
    {
      label: "Aralar",
      value: `${h2h.homeWins}-${h2h.draws}-${h2h.awayWins}`,
      detail: "Ev sahibi galibiyetleri, beraberlik ve deplasman galibiyetleri"
    },
    {
      label: shots ? translateStatisticLabel(shots.name) : "aiXp",
      value: shots ? `${shots.homeDisplay} - ${shots.awayDisplay}` : leader?.value ?? "-",
      detail: shots
        ? `${shots.homeNumber > shots.awayNumber ? match.homeTeam.name : shots.awayNumber > shots.homeNumber ? match.awayTeam.name : "İki takım"} veri çizgisinde önde`
        : leader
          ? `${leader.team} olasılık lideri`
          : "Veri geldikçe sinyal üretilecek"
    }
  ];
}

function summarizeResults(matches: NormalizedMatch[], homeTeam: Team, awayTeam: Team) {
  return matches.reduce(
    (summary, item) => {
      const homeScore = item.score.home;
      const awayScore = item.score.away;
      if (homeScore === null || awayScore === null) return summary;
      if (homeScore === awayScore) return { ...summary, draws: summary.draws + 1 };

      const winnerId = homeScore > awayScore ? item.homeTeam.id : item.awayTeam.id;
      if (winnerId === homeTeam.id) return { ...summary, homeWins: summary.homeWins + 1 };
      if (winnerId === awayTeam.id) return { ...summary, awayWins: summary.awayWins + 1 };
      return summary;
    },
    { homeWins: 0, draws: 0, awayWins: 0 }
  );
}

function findStandingRow(standings: MatchDetail["standings"], teamId: string) {
  return standings?.groups.flatMap((group) => group.rows).find((row) => row.team.id === teamId) ?? null;
}

function buildStandingWindow(standings: MatchDetail["standings"], homeTeamId: string, awayTeamId: string) {
  const allRows = standings?.groups.flatMap((group) => group.rows) ?? [];
  if (allRows.length === 0) return [];

  const orderedRows = [...allRows].sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));
  const focusIndexes = [homeTeamId, awayTeamId]
    .map((teamId) => orderedRows.findIndex((row) => row.team.id === teamId))
    .filter((index) => index >= 0);

  const indexes = new Set<number>();
  for (const index of focusIndexes) {
    indexes.add(index - 1);
    indexes.add(index);
    indexes.add(index + 1);
  }

  for (let index = 0; indexes.size < 8 && index < orderedRows.length; index += 1) {
    indexes.add(index);
  }

  return Array.from(indexes)
    .filter((index) => index >= 0 && index < orderedRows.length)
    .sort((a, b) => a - b)
    .map((index) => orderedRows[index]);
}

function formatGoalDifference(row: MatchDetailStandingRow) {
  const goalDifference = row.total.scoredGoals - row.total.receivedGoals;
  if (goalDifference > 0) return `+${goalDifference}`;
  return String(goalDifference);
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
  return matches.reduce((total, item) => {
    const result = resultForTeam(item, teamId);
    if (result === "win") return total + 3;
    if (result === "draw") return total + 1;
    return total;
  }, 0);
}

function atmosphereSummary(match: NormalizedMatch) {
  if (match.status.group === "live") {
    return "Canlı skor, olaylar, istatistik dengesi ve aiXp sinyalleri aynı ekranda akıyor.";
  }

  if (match.status.group === "finished") {
    return "Final skorun arkasındaki olaylar, istatistik kırılımları ve maç sonrası veri özeti burada.";
  }

  return "Maç başlamadan önce form, puan, aralarındaki maçlar, oyuncu profilleri ve aiXp ön değerlendirmesi burada.";
}

function formatStatus(match: NormalizedMatch) {
  return formatMatchStatusLabel(match);
}

function formatScoreline(match: NormalizedMatch) {
  if (match.status.group === "upcoming") return match.localTime;
  if (match.score.home === null || match.score.away === null) return "-";
  return `${match.score.home} - ${match.score.away}`;
}

function formatRound(value: string) {
  const regular = value.match(/^Regular Season\s*-\s*(\d+)$/i);
  if (regular) return `Normal Sezon ${regular[1]}. Hafta`;

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
    Snow: "Karlı"
  };

  return labels[value] ?? labels[value.toLowerCase()] ?? value;
}

function formatRefreshLabel(detail: MatchDetail | null) {
  if (!detail) return "Veri bekleniyor";
  if (detail.refreshPolicy.reason === "live") return `${detail.refreshPolicy.clientRefreshSeconds}s canlı`;
  if (detail.refreshPolicy.reason === "locked") return "Kilitli veri";
  if (detail.refreshPolicy.reason === "finished") return "Maç sonu";
  return `${detail.refreshPolicy.clientRefreshSeconds}s yenileme`;
}

function formatPlayerStat(player: MatchDetailTopPlayer) {
  const stat = player.statistics.find((item) => item.value !== null && item.value !== undefined && item.value !== "");
  if (!stat) return "-";
  return `${stat.name}: ${stat.value}`;
}

function eventSide(event: MatchDetailEvent, match: NormalizedMatch) {
  if (event.team.id === match.homeTeam.id) return "home";
  if (event.team.id === match.awayTeam.id) return "away";
  return "neutral";
}

function eventIcon(type: string) {
  if (type.includes("Goal") || type.includes("Penalty")) return <Target size={14} />;
  if (type.includes("Card")) return <Shield size={14} />;
  return <Activity size={14} />;
}

function eventClass(type: string) {
  if (type.includes("Red")) return "red";
  if (type.includes("Yellow")) return "yellow";
  if (type.includes("Goal") || type.includes("Penalty")) return "goal";
  if (type.includes("Substitution")) return "substitution";
  return "";
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
