import {
  Activity,
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  CalendarClock,
  ChevronsRight,
  CloudSun,
  Flag,
  Gauge,
  ListOrdered,
  MapPin,
  Moon,
  Percent,
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
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, TouchEvent } from "react";
import { ComparisonMomentumChart } from "./ComparisonMomentumChart";
import type { ComparisonChartItem } from "./ComparisonMomentumChart";
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
  MatchGoalHighlight,
  NormalizedMatch,
  Team,
  UserProfile
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
  goalHighlight?: MatchGoalHighlight | null;
  chatProfile?: UserProfile | null;
  chatAccessToken?: string | null;
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
type MobileAtmosphereTab = "data" | "chat" | "stats" | "h2h" | "standings" | "lineups" | "aixp";
type MobileSwipeDirection = "forward" | "backward";
type AixpSparkle = { id: string; x: string; y: string; size: string; delay: string; rotate: string };
type PredictionRow = { key: "home" | "draw" | "away"; label: string; team: string; value: string; number: number };
type InsightKind = "status" | "form" | "comparison" | "data" | "aixp";
type StandingPulseKind = "champions" | "europa" | "conference" | "promotion" | "playoff" | "relegation";
type KnockoutTieInfo = {
  stageLabel: string;
  legLabel: string;
  heroLabel: string;
  previousLeg: NormalizedMatch | null;
  previousScoreLabel: string | null;
  previousScoreDetail: string | null;
  aggregateLabel: string | null;
};
type StandingZoneRule = {
  champions?: number;
  europa?: number;
  conference?: number;
  promotion?: number;
  playoffFrom?: number;
  playoffTo?: number;
  relegation?: number;
};
type AtmosphereLineupTeam = NonNullable<MatchDetail["lineups"]>["home"];
type AtmosphereLineupPlayer = NonNullable<AtmosphereLineupTeam>["initialLineup"][number][number];

const mobileAtmosphereTabs: { key: MobileAtmosphereTab; label: string }[] = [
  { key: "data", label: "Özet" },
  { key: "chat", label: "Sohbet" },
  { key: "stats", label: "İstatistik" },
  { key: "h2h", label: "H2H" },
  { key: "standings", label: "Puan" },
  { key: "lineups", label: "Diziliş" },
  { key: "aixp", label: "AIXP" }
];

const AIXP_SPARKLE_COUNT = 10;
const AIXP_SPARKLE_INTERVAL_MS = 5_000;
const MOBILE_TAB_SETTLE_MS = 560;

interface InsightSegment {
  key: "home" | "draw" | "away";
  label: string;
  value: number;
  display: string;
}

interface InsightRow {
  label: string;
  value: string;
  detail: string;
  kind: InsightKind;
  progress?: number;
  segments?: InsightSegment[];
}

type PressureEventKind = "goal" | "goalCancelled" | "penalty" | "corner" | "yellow" | "red" | "substitution" | "var" | "event";
type ComparisonMetricKind = "attack" | "danger" | "possession";
type LineMetricKind = "corner" | "yellow" | "red" | "target" | "missed";

interface PressurePoint {
  minute: number;
  home: number;
  away: number;
  future: boolean;
}

interface PressureEventMarker {
  key: string;
  minute: number;
  side: "home" | "away";
  kind: PressureEventKind;
  label: string;
}

interface StatisticPair {
  home: number;
  away: number;
  found: boolean;
}

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

interface ComparisonMetric {
  key: ComparisonMetricKind;
  label: string;
  home: number;
  away: number;
  center: ComparisonMetricKind;
}

interface LineMetric {
  key: LineMetricKind;
  label: string;
  home: number;
  away: number;
  icon: LineMetricKind;
}

interface LiveAtmosphereData {
  pressure: {
    homeShare: number;
    awayShare: number;
    series: PressurePoint[];
    events: PressureEventMarker[];
    hasData: boolean;
  };
  circles: ComparisonMetric[];
  lines: LineMetric[];
}

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
  backLabel = "Maç listesi",
  goalHighlight = null,
  chatProfile = null,
  chatAccessToken = null
}: MatchAtmosphereOverlayProps) {
  const [activeTab, setActiveTab] = useState<AtmosphereTab>("overview");
  const [mobileTab, setMobileTab] = useState<MobileAtmosphereTab>("data");
  const [mobileSwipeDirection, setMobileSwipeDirection] = useState<MobileSwipeDirection | null>(null);
  const [mobileSwipeOffset, setMobileSwipeOffset] = useState(0);
  const [mobileSwipeWidth, setMobileSwipeWidth] = useState(0);
  const [mobileSwipeDragging, setMobileSwipeDragging] = useState(false);
  const [mobileSwipeSettling, setMobileSwipeSettling] = useState(false);
  const [mobileRenderAllPanels, setMobileRenderAllPanels] = useState(false);
  const [aixpSparkles, setAixpSparkles] = useState<AixpSparkle[]>(() => createAixpSparkles());
  const [compactHeroVisible, setCompactHeroVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const mobileSwipeViewportRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const mobileSwipeRef = useRef<{ x: number; y: number; tab: MobileAtmosphereTab; horizontalLocked: boolean } | null>(null);
  const activeMatch = useMemo(() => syncLiveSnapshot(match, detail?.match), [detail?.match, match]);
  const activeGoalHighlight = activeMatch.status.group === "live" ? goalHighlight : null;
  const rawHomeAccent = useTeamAccent(activeMatch.homeTeam);
  const rawAwayAccent = useTeamAccent(activeMatch.awayTeam);
  const homeAccent = useMemo(() => normalizeLightAccent(rawHomeAccent, colorMode), [colorMode, rawHomeAccent]);
  const awayAccent = useMemo(() => normalizeLightAccent(rawAwayAccent, colorMode), [colorMode, rawAwayAccent]);
  const accentStyle = useMemo(
    () =>
      ({
        "--home-accent": homeAccent,
        "--away-accent": awayAccent
      }) as CSSProperties,
    [awayAccent, homeAccent]
  );
  const prediction = detail?.predictions.latestLive ?? detail?.predictions.latestPrematch ?? null;
  const statisticRows = useMemo(() => buildStatisticRows(activeMatch, detail), [activeMatch, detail]);
  const totalStatisticRows = useMemo(() => statisticRowsForPeriod(statisticRows, "all"), [statisticRows]);
  const liveAtmosphere = useMemo(() => buildLiveAtmosphereData(activeMatch, detail, totalStatisticRows), [activeMatch, detail, totalStatisticRows]);
  const predictionRows = useMemo(() => buildPredictionRows(activeMatch, prediction), [activeMatch, prediction]);
  const aiSummary = useMemo(() => buildAiSummary(activeMatch, predictionRows), [activeMatch, predictionRows]);
  const insightRows = useMemo(() => buildInsightRows(activeMatch, detail, totalStatisticRows, predictionRows), [activeMatch, detail, totalStatisticRows, predictionRows]);
  const h2hMatches = useMemo(() => (detail?.headToHead ?? []).filter((item) => item.id !== activeMatch.id), [activeMatch.id, detail?.headToHead]);
  const h2hSummary = useMemo(() => summarizeResults(h2hMatches, activeMatch.homeTeam, activeMatch.awayTeam), [activeMatch, h2hMatches]);
  const knockoutTieInfo = useMemo(() => buildKnockoutTieInfo(activeMatch, h2hMatches), [activeMatch, h2hMatches]);
  const h2hChartItems = useMemo<ComparisonChartItem[]>(
    () => [
      { label: activeMatch.homeTeam.name, shortLabel: "Ev", value: h2hSummary.homeWins, suffix: "G", tone: "home" },
      { label: "Beraberlik", shortLabel: "X", value: h2hSummary.draws, suffix: "B", tone: "draw" },
      { label: activeMatch.awayTeam.name, shortLabel: "Dep", value: h2hSummary.awayWins, suffix: "G", tone: "away" }
    ],
    [activeMatch.awayTeam.name, activeMatch.homeTeam.name, h2hSummary.awayWins, h2hSummary.draws, h2hSummary.homeWins]
  );
  const homeStanding = useMemo(() => findStandingRow(detail?.standings ?? null, activeMatch.homeTeam.id), [activeMatch.homeTeam.id, detail?.standings]);
  const awayStanding = useMemo(() => findStandingRow(detail?.standings ?? null, activeMatch.awayTeam.id), [activeMatch.awayTeam.id, detail?.standings]);
  const ThemeIcon = colorMode === "dark" ? Sun : Moon;
  const themeToggleLabel = colorMode === "dark" ? "Açık moda geç" : "Koyu moda geç";
  const compactScoreline = formatCompactScoreline(activeMatch);
  const shouldShowLiveAtmosphere = activeMatch.status.group === "live" || activeMatch.status.group === "finished";
  const atmosphereStageLabel = formatAtmosphereStageLabel(activeMatch.round, activeMatch.league.name);
  const statusLabel = formatStatus(activeMatch);
  const scorelineLabel = formatScoreline(activeMatch);
  const showStatusPill = activeMatch.status.group !== "upcoming" || statusLabel !== scorelineLabel;
  const standingTabLabel = knockoutTieInfo ? "Eleme" : "Puan";
  const activeMobileTabIndex = Math.max(0, mobileAtmosphereTabs.findIndex((tab) => tab.key === mobileTab));
  const mobileSwipeTrackStyle = {
    transform: `translate3d(${mobileSwipeDragging ? mobileSwipeOffset : 0}px, 0, 0)`
  } as CSSProperties;
  const mobileSwipeTrackClassName = [
    "atmosphereMobileSwipeTrack",
    mobileSwipeDragging ? "dragging" : "",
    mobileSwipeSettling ? "settling" : "",
    mobileSwipeDirection ? `swipe${capitalizeSwipeDirection(mobileSwipeDirection)}` : ""
  ].filter(Boolean).join(" ");
  const mobileContentPanelClassName = "atmosphereMobileTabPanel atmosphereMobileContentPanel atmosphereOverviewOnly";
  const mobileChatPanelClassName = "atmosphereMobileTabPanel atmosphereMobileChatPanel atmosphereOverviewOnly";
  const mobileAixpPanelClassName = "atmosphereMobileTabPanel atmosphereMobileAixpPanel atmosphereMobileContentPanel atmosphereOverviewOnly";
  const goToMobileTab = (nextTab: MobileAtmosphereTab, direction?: MobileSwipeDirection) => {
    if (nextTab === mobileTab) {
      setMobileSwipeOffset(0);
      return;
    }

    const currentIndex = activeMobileTabIndex;
    const nextIndex = mobileAtmosphereTabs.findIndex((tab) => tab.key === nextTab);
    const inferredDirection = direction ?? (nextIndex > currentIndex ? "forward" : "backward");

    setMobileRenderAllPanels(Math.abs(nextIndex - currentIndex) > 1);
    setMobileSwipeDragging(false);
    setMobileSwipeSettling(true);
    setMobileSwipeDirection(inferredDirection);
    setMobileSwipeOffset(0);
    setMobileTab(nextTab);
  };
  const handleMobileTabChange = (nextTab: MobileAtmosphereTab) => {
    goToMobileTab(nextTab);
  };
  const selectAdjacentMobileTab = (direction: -1 | 1) => {
    const nextIndex = Math.min(Math.max(activeMobileTabIndex + direction, 0), mobileAtmosphereTabs.length - 1);
    const nextTab = mobileAtmosphereTabs[nextIndex]?.key;
    if (!nextTab || nextTab === mobileTab) return;

    goToMobileTab(nextTab, direction > 0 ? "forward" : "backward");
  };

  const handleMobileSwipeStart = (event: TouchEvent<HTMLElement>) => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 760px)").matches) return;
    if (isSwipeControlTarget(event.target)) return;

    const touch = event.touches[0];
    if (!touch) return;

    setMobileSwipeSettling(false);
    setMobileSwipeDirection(null);
    setMobileSwipeOffset(0);
    mobileSwipeRef.current = { x: touch.clientX, y: touch.clientY, tab: mobileTab, horizontalLocked: false };
  };

  const handleMobileSwipeMove = (event: TouchEvent<HTMLElement>) => {
    const start = mobileSwipeRef.current;
    if (!start || start.tab !== mobileTab) return;
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 760px)").matches) return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!start.horizontalLocked) {
      if (absY > 8 && absY > absX * 1.05) {
        mobileSwipeRef.current = null;
        setMobileSwipeDragging(false);
        setMobileSwipeOffset(0);
        return;
      }

      if (absX < 14 || absX < absY * 1.25) return;

      start.horizontalLocked = true;
      setMobileSwipeDragging(true);
    }

    event.preventDefault();

    const atFirstTab = activeMobileTabIndex === 0;
    const atLastTab = activeMobileTabIndex === mobileAtmosphereTabs.length - 1;
    const boundedDelta = (atFirstTab && deltaX > 0) || (atLastTab && deltaX < 0) ? deltaX * 0.28 : deltaX;
    const maxOffset = Math.max(120, mobileSwipeWidth * 0.92);
    setMobileSwipeOffset(Math.max(-maxOffset, Math.min(maxOffset, boundedDelta)));
  };

  const handleMobileSwipeEnd = (event: TouchEvent<HTMLElement>) => {
    const start = mobileSwipeRef.current;
    mobileSwipeRef.current = null;
    if (!start || start.tab !== mobileTab) {
      setMobileSwipeDragging(false);
      setMobileSwipeOffset(0);
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      setMobileSwipeDragging(false);
      setMobileSwipeOffset(0);
      return;
    }

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const threshold = Math.min(76, Math.max(42, mobileSwipeWidth * 0.16));
    const horizontalSwipe = start.horizontalLocked && Math.abs(deltaX) >= threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.12;

    setMobileSwipeDragging(false);
    setMobileSwipeSettling(true);
    setMobileSwipeOffset(0);

    if (horizontalSwipe) {
      selectAdjacentMobileTab(deltaX < 0 ? 1 : -1);
      return;
    }

    setMobileSwipeDirection(null);
  };

  const handleMobileSwipeCancel = () => {
    mobileSwipeRef.current = null;
    setMobileSwipeDragging(false);
    setMobileSwipeSettling(true);
    setMobileSwipeOffset(0);
    setMobileSwipeDirection(null);
  };

  useEffect(() => {
    setActiveTab("overview");
    setMobileTab("data");
    setMobileSwipeDirection(null);
    setMobileSwipeDragging(false);
    setMobileSwipeSettling(false);
    setMobileSwipeOffset(0);
    setMobileRenderAllPanels(false);
    setCompactHeroVisible(false);
  }, [match.id]);

  useEffect(() => {
    if (!mobileSwipeDirection && !mobileSwipeSettling && !mobileRenderAllPanels) return;

    const timer = window.setTimeout(() => {
      setMobileSwipeDirection(null);
      setMobileSwipeSettling(false);
      setMobileRenderAllPanels(false);
    }, MOBILE_TAB_SETTLE_MS + 80);
    return () => window.clearTimeout(timer);
  }, [mobileRenderAllPanels, mobileSwipeDirection, mobileSwipeSettling, mobileTab]);

  useEffect(() => {
    const viewport = mobileSwipeViewportRef.current;
    if (!viewport) return;

    const updateWidth = () => setMobileSwipeWidth(viewport.clientWidth);
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      window.addEventListener("orientationchange", updateWidth);
      return () => {
        window.removeEventListener("resize", updateWidth);
        window.removeEventListener("orientationchange", updateWidth);
      };
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(viewport);
    window.addEventListener("orientationchange", updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", updateWidth);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    const interval = window.setInterval(() => {
      setAixpSparkles(createAixpSparkles());
    }, AIXP_SPARKLE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateVisualViewportVars = () => {
      const viewport = window.visualViewport;
      const visualHeight = viewport?.height ?? window.innerHeight;
      const viewportTop = viewport?.offsetTop ?? 0;
      const keyboardInset = Math.max(0, window.innerHeight - visualHeight - viewportTop);
      const visualHeightValue = `${Math.round(visualHeight)}px`;
      const keyboardInsetValue = `${Math.round(keyboardInset)}px`;

      document.documentElement.style.setProperty("--scorexp-visual-viewport-height", visualHeightValue);
      document.body.style.setProperty("--scorexp-visual-viewport-height", visualHeightValue);
      document.documentElement.style.setProperty("--scorexp-keyboard-inset", keyboardInsetValue);
      document.body.style.setProperty("--scorexp-keyboard-inset", keyboardInsetValue);
    };

    updateVisualViewportVars();
    window.visualViewport?.addEventListener("resize", updateVisualViewportVars);
    window.visualViewport?.addEventListener("scroll", updateVisualViewportVars);
    window.addEventListener("resize", updateVisualViewportVars);

    return () => {
      window.visualViewport?.removeEventListener("resize", updateVisualViewportVars);
      window.visualViewport?.removeEventListener("scroll", updateVisualViewportVars);
      window.removeEventListener("resize", updateVisualViewportVars);
      document.documentElement.style.removeProperty("--scorexp-visual-viewport-height");
      document.body.style.removeProperty("--scorexp-visual-viewport-height");
      document.documentElement.style.removeProperty("--scorexp-keyboard-inset");
      document.body.style.removeProperty("--scorexp-keyboard-inset");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = window.matchMedia("(max-width: 760px)");
    const updateChatActiveClass = () => {
      const active = mobileTab === "chat" && query.matches;
      document.documentElement.classList.toggle("scorexpAtmosphereChatActive", active);
      document.body.classList.toggle("scorexpAtmosphereChatActive", active);
    };

    updateChatActiveClass();
    query.addEventListener("change", updateChatActiveClass);

    return () => {
      query.removeEventListener("change", updateChatActiveClass);
      document.documentElement.classList.remove("scorexpAtmosphereChatActive");
      document.body.classList.remove("scorexpAtmosphereChatActive");
    };
  }, [mobileTab]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const overlay = overlayRef.current;
    let animationFrame = 0;

    const updateCompactHero = () => {
      if (animationFrame) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        const hero = heroRef.current;
        const tickerHeight = Math.min(Math.max(window.innerHeight * 0.1, 58), 96);
        const fallbackScrollTop = Math.max(
          scrollContainer?.scrollTop ?? 0,
          overlay?.scrollTop ?? 0,
          window.scrollY,
          document.documentElement.scrollTop,
          document.body.scrollTop
        );

        setCompactHeroVisible((isCompact) => {
          if (!hero) return isCompact ? fallbackScrollTop > 72 : fallbackScrollTop > 150;

          const heroBottom = hero.getBoundingClientRect().bottom;
          const enterAt = tickerHeight + 16;
          const exitAt = tickerHeight + 96;

          return isCompact ? heroBottom < exitAt : heroBottom < enterAt;
        });
      });
    };

    updateCompactHero();
    scrollContainer?.addEventListener("scroll", updateCompactHero, { passive: true });
    overlay?.addEventListener("scroll", updateCompactHero, { passive: true });
    window.addEventListener("scroll", updateCompactHero, { passive: true });
    window.addEventListener("resize", updateCompactHero);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      scrollContainer?.removeEventListener("scroll", updateCompactHero);
      overlay?.removeEventListener("scroll", updateCompactHero);
      window.removeEventListener("scroll", updateCompactHero);
      window.removeEventListener("resize", updateCompactHero);
    };
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
      if (nextTab === "chat" && window.matchMedia("(max-width: 760px)").matches) {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
        window.scrollTo({ top: 0, behavior: "auto" });
        return;
      }

      document.getElementById(targetId)?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
    });
  };

  const renderMobileTabPanel = (tabKey: MobileAtmosphereTab) => {
    switch (tabKey) {
      case "data":
        return (
          <section className={`${mobileContentPanelClassName} atmosphereMobileDataPanel`} aria-label="Özet">
            {shouldShowLiveAtmosphere ? (
              <div className="atmosphereLiveStack">
                <PressureMeterCard match={activeMatch} data={liveAtmosphere} />
                <ComparativePulseCard match={activeMatch} data={liveAtmosphere} />
              </div>
            ) : null}
            <section className="atmospherePanel">
              <PanelTitle icon={<Zap size={17} />} label={activeMatch.status.group === "upcoming" ? "Maç Öncesi Akış" : "Maç Akışı"} />
              <EventTimeline events={detail?.events ?? []} match={activeMatch} />
            </section>
            <section className="atmosphereSignalStrip" aria-label="Maç sinyalleri">
              <SignalMetric icon={<CalendarClock size={16} />} label="Başlangıç" value={`${formatDate(activeMatch.date)} • ${activeMatch.localTime}`} />
              <SignalMetric icon={<MapPin size={16} />} label="Stat" value={formatVenue(detail) ?? "Veri yok"} />
              <SignalMetric icon={<CloudSun size={16} />} label="Hava" value={formatForecast(detail) ?? "Veri yok"} />
              <SignalMetric icon={<Trophy size={16} />} label="Lig" value={activeMatch.league.name} />
            </section>
          </section>
        );
      case "chat":
        return (
          <section className={mobileChatPanelClassName} aria-label="Sohbet">
            <MatchChatRoom match={activeMatch} variant="embedded" profile={chatProfile} accessToken={chatAccessToken} />
          </section>
        );
      case "stats":
        return (
          <section className={mobileContentPanelClassName} aria-label="İstatistik">
            <section className="atmospherePanel">
              <PanelTitle icon={<BarChart3 size={17} />} label={activeMatch.status.group === "upcoming" ? "Ön Maç Veri Dengesi" : "Maç İstatistikleri"} />
              <StatisticCompare match={activeMatch} rows={statisticRows} />
            </section>
          </section>
        );
      case "h2h":
        return (
          <section className={mobileContentPanelClassName} aria-label="H2H">
            <section className="atmospherePanel">
              <PanelTitle icon={<Shield size={17} />} label="Mukayese Momentumu" />
              <ComparisonMomentumChart items={h2hChartItems} className="atmosphereComparisonChart" />
              <RecentHeadToHead matches={h2hMatches} focusTeamId={activeMatch.homeTeam.id} />
            </section>
            <section className="atmospherePanel">
              <PanelTitle icon={<Activity size={17} />} label="Son 5 Maç Gol Formu" />
              <FormGoalsGraph
                homeTeam={activeMatch.homeTeam}
                awayTeam={activeMatch.awayTeam}
                homeMatches={detail?.form?.home ?? []}
                awayMatches={detail?.form?.away ?? []}
              />
            </section>
            <section className="atmospherePanel">
              <PanelTitle icon={<Gauge size={17} />} label="Normal Form Durumu" />
              <div className="atmosphereFormGrid">
                <FormColumn team={activeMatch.homeTeam} matches={detail?.form?.home ?? []} />
                <FormColumn team={activeMatch.awayTeam} matches={detail?.form?.away ?? []} />
              </div>
            </section>
          </section>
        );
      case "standings":
        return (
          <section className={mobileContentPanelClassName} aria-label={standingTabLabel}>
            <section className="atmospherePanel atmosphereStandingFullPanel">
              <PanelTitle icon={knockoutTieInfo ? <Trophy size={17} /> : <ListOrdered size={17} />} label={knockoutTieInfo ? "Eleme Durumu" : "Tam Puan Tablosu"} />
              {knockoutTieInfo ? (
                <KnockoutTiePanel match={activeMatch} tieInfo={knockoutTieInfo} />
              ) : (
                <FullStandingTable
                  standings={detail?.standings ?? null}
                  homeTeamId={activeMatch.homeTeam.id}
                  awayTeamId={activeMatch.awayTeam.id}
                  countryName={activeMatch.country.name}
                />
              )}
            </section>
          </section>
        );
      case "lineups":
        return (
          <section className={mobileContentPanelClassName} aria-label="Diziliş">
            <section className="atmospherePanel">
              <PanelTitle icon={<UsersRound size={17} />} label="Saha Dizilişi" />
              <AtmosphereLineupsView match={activeMatch} lineups={detail?.lineups ?? null} />
            </section>
            <section className="atmospherePanel">
              <PanelTitle icon={<UsersRound size={17} />} label="Oyuncu Profilleri" />
              <div className="atmospherePlayerGrid">
                <PlayerColumn team={activeMatch.homeTeam} players={detail?.topPlayers.home ?? []} />
                <PlayerColumn team={activeMatch.awayTeam} players={detail?.topPlayers.away ?? []} />
              </div>
            </section>
          </section>
        );
      case "aixp":
        return (
          <section className={mobileAixpPanelClassName} aria-label="AIXP">
            <section className="atmospherePanel atmosphereAiPanel">
              <PanelTitle icon={<BrainCircuit size={17} />} label="aiXp Analizi" />
              <strong>{aiSummary.title}</strong>
              <p>{aiSummary.summary}</p>
              {predictionRows.length > 0 ? (
                <div className="atmosphereProbabilityBars">
                  {predictionRows.map((item) => (
                    <div className={item.key} key={item.label}>
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
                  <InsightCard item={item} key={item.label} />
                ))}
              </div>
            </section>
          </section>
        );
      default:
        return null;
    }
  };

  const shellClassName = [
    "matchAtmosphereShell",
    activeMatch.status.group,
    activeGoalHighlight ? "goalScored" : "",
    activeGoalHighlight?.phase === "pending" ? "goalPending" : "",
    activeGoalHighlight?.phase === "confirmed" ? "goalConfirmed" : "",
    activeTab === "chat" ? "chatTabActive" : "overviewTabActive",
    `mobile${capitalizeMobileTab(mobileTab)}TabActive`,
    compactHeroVisible ? "compactHeroVisible chatHeroCompact" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className="matchAtmosphereOverlay" role="dialog" aria-modal="true" aria-label="Maç atmosferi" ref={overlayRef}>
      <section className={shellClassName} style={accentStyle}>
        <header className="atmosphereTopbar">
          <button className="atmosphereBackButton" type="button" onClick={onRequestClose}>
            <ArrowLeft size={17} />
            <span>{backLabel}</span>
          </button>

          <div className="atmosphereLeagueTitle" title={activeMatch.league.name}>
            <AtmosphereLeagueLogo src={activeMatch.league.logo} label={activeMatch.league.name} />
            <strong title={activeMatch.league.name}>{activeMatch.league.name}</strong>
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

          <main
            className="atmosphereScroll"
            ref={scrollContainerRef}
          >
            <div className={`atmosphereCompactHero ${activeGoalHighlight ? "goalScored" : ""} ${activeGoalHighlight?.phase === "pending" ? "goalPending" : ""} ${activeGoalHighlight?.phase === "confirmed" ? "goalConfirmed" : ""}`} aria-hidden={!compactHeroVisible}>
              <div className="atmosphereCompactHeroInner withScore">
                <div className="atmosphereCompactTeam home">
                  <TeamLogo src={activeMatch.homeTeam.logo} label={activeMatch.homeTeam.name} size="lg" />
                  <span>{activeMatch.homeTeam.name}</span>
                </div>
                <strong className={`atmosphereCompactScoreline ${activeMatch.status.group}`}>{compactScoreline}</strong>
                <div className="atmosphereCompactTeam away">
                  <TeamLogo src={activeMatch.awayTeam.logo} label={activeMatch.awayTeam.name} size="lg" />
                  <span>{activeMatch.awayTeam.name}</span>
                </div>
              </div>
            </div>

            <section className={`atmosphereHero ${activeGoalHighlight ? "goalScored" : ""} ${activeGoalHighlight?.phase === "pending" ? "goalPending" : ""} ${activeGoalHighlight?.phase === "confirmed" ? "goalConfirmed" : ""}`} id="atmosphere-overview" ref={heroRef}>
              {activeGoalHighlight ? <span className="atmosphereGoalSweep" aria-hidden="true" /> : null}
              {atmosphereStageLabel ? <span className="atmosphereStageLabel">{atmosphereStageLabel}</span> : null}
              <AtmosphereTeam team={activeMatch.homeTeam} side="home" standing={homeStanding} form={detail?.form?.home ?? []} accent={homeAccent} goalActive={isGoalSide(activeGoalHighlight?.side ?? null, "home")} />
              <div className="atmosphereScoreStage">
                {showStatusPill ? <span className={`atmosphereStatusPill ${activeMatch.status.group}`}>{statusLabel}</span> : null}
                <div className="atmosphereScoreline">{scorelineLabel}</div>
                <strong>Maç Atmosferi</strong>
                <p>{atmosphereSummary(activeMatch)}</p>
              </div>
              <AtmosphereTeam team={activeMatch.awayTeam} side="away" standing={awayStanding} form={detail?.form?.away ?? []} accent={awayAccent} goalActive={isGoalSide(activeGoalHighlight?.side ?? null, "away")} />
              <HeroPredictionLine rows={predictionRows} homeTeam={activeMatch.homeTeam} awayTeam={activeMatch.awayTeam} tieInfo={knockoutTieInfo} />
            </section>

            {loading ? <div className="atmosphereNotice atmosphereOverviewOnly">Detay verileri yükleniyor</div> : null}
            {error ? <div className="atmosphereNotice error atmosphereOverviewOnly">{error}</div> : null}

            <MobileAtmosphereTabs activeTab={mobileTab} onChange={handleMobileTabChange} sparkles={aixpSparkles} standingsLabel={standingTabLabel} />
            <div
              className="atmosphereMobileSwipeViewport atmosphereOverviewOnly"
              ref={mobileSwipeViewportRef}
              onTouchStart={handleMobileSwipeStart}
              onTouchMove={handleMobileSwipeMove}
              onTouchEnd={handleMobileSwipeEnd}
              onTouchCancel={handleMobileSwipeCancel}
            >
              <div className={`atmosphereMobileActivePanel ${mobileSwipeTrackClassName}`} style={mobileSwipeTrackStyle}>
                {renderMobileTabPanel(mobileTab)}
              </div>
            </div>
            {shouldShowLiveAtmosphere ? (
              <>
                <div className="atmosphereLiveStack atmosphereOverviewOnly atmosphereDesktopOnly">
                  <PressureMeterCard match={activeMatch} data={liveAtmosphere} />
                  <ComparativePulseCard match={activeMatch} data={liveAtmosphere} />
                </div>
              </>
            ) : null}

            <section className="atmosphereGrid atmosphereOverviewOnly atmosphereDesktopOnly">
              <section className="atmospherePanel atmosphereAiPanel" id="atmosphere-ai">
                <PanelTitle icon={<BrainCircuit size={17} />} label="aiXp Analizi" />
                <strong>{aiSummary.title}</strong>
                <p>{aiSummary.summary}</p>
                {predictionRows.length > 0 ? (
                  <div className="atmosphereProbabilityBars">
                    {predictionRows.map((item) => (
                      <div className={item.key} key={item.label}>
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
                    <InsightCard item={item} key={item.label} />
                  ))}
                </div>
              </section>
            </section>

            <section className="atmospherePanel atmosphereOverviewOnly atmosphereDesktopOnly" id="atmosphere-data">
              <PanelTitle icon={<BarChart3 size={17} />} label={activeMatch.status.group === "upcoming" ? "Ön Maç Veri Dengesi" : "Maç İstatistikleri"} />
              <StatisticCompare match={activeMatch} rows={statisticRows} />
            </section>

            <section className="atmosphereTwinGrid atmosphereOverviewOnly atmosphereDesktopOnly" id="atmosphere-history">
              <section className="atmospherePanel">
                <PanelTitle icon={<Shield size={17} />} label="Mukayese ve Form" />
                <ComparisonMomentumChart items={h2hChartItems} className="atmosphereComparisonChart" />
                <FormGoalsGraph
                  homeTeam={activeMatch.homeTeam}
                  awayTeam={activeMatch.awayTeam}
                  homeMatches={detail?.form?.home ?? []}
                  awayMatches={detail?.form?.away ?? []}
                />
                <div className="atmosphereFormGrid">
                  <FormColumn team={activeMatch.homeTeam} matches={detail?.form?.home ?? []} />
                  <FormColumn team={activeMatch.awayTeam} matches={detail?.form?.away ?? []} />
                </div>
                <RecentHeadToHead matches={h2hMatches} focusTeamId={activeMatch.homeTeam.id} />
              </section>

              <section className="atmospherePanel">
                <PanelTitle icon={knockoutTieInfo ? <Trophy size={17} /> : <ListOrdered size={17} />} label={knockoutTieInfo ? "Eleme Durumu" : "Puan ve Konum"} />
                {knockoutTieInfo ? (
                  <KnockoutTiePanel match={activeMatch} tieInfo={knockoutTieInfo} compact />
                ) : (
                  <StandingSnapshot
                    standings={detail?.standings ?? null}
                    homeTeamId={activeMatch.homeTeam.id}
                    awayTeamId={activeMatch.awayTeam.id}
                  />
                )}
              </section>
            </section>

            <section className="atmospherePanel atmosphereOverviewOnly atmosphereDesktopOnly" id="atmosphere-players">
              <PanelTitle icon={<UsersRound size={17} />} label="Oyuncu Profilleri" />
              <div className="atmospherePlayerGrid">
                <PlayerColumn team={activeMatch.homeTeam} players={detail?.topPlayers.home ?? []} />
                <PlayerColumn team={activeMatch.awayTeam} players={detail?.topPlayers.away ?? []} />
              </div>
            </section>

            <section className="atmospherePanel atmosphereOverviewOnly atmosphereDesktopOnly">
              <PanelTitle icon={<Zap size={17} />} label={activeMatch.status.group === "upcoming" ? "Maç Öncesi Akış" : "Maç Akışı"} />
              <EventTimeline events={detail?.events ?? []} match={activeMatch} />
            </section>

            <section className="atmosphereSignalStrip atmosphereOverviewOnly atmosphereDesktopOnly" aria-label="Maç sinyalleri">
              <SignalMetric icon={<CalendarClock size={16} />} label="Başlangıç" value={`${formatDate(activeMatch.date)} • ${activeMatch.localTime}`} />
              <SignalMetric icon={<MapPin size={16} />} label="Stat" value={formatVenue(detail) ?? "Veri yok"} />
              <SignalMetric icon={<CloudSun size={16} />} label="Hava" value={formatForecast(detail) ?? "Veri yok"} />
              <SignalMetric icon={<Trophy size={16} />} label="Lig" value={activeMatch.league.name} />
            </section>
          </main>
          <aside className="atmosphereChatDock" id="atmosphere-chat" aria-label="Maç sohbeti">
            <MatchChatRoom match={activeMatch} variant="embedded" profile={chatProfile} accessToken={chatAccessToken} />
          </aside>
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
    review: match.review,
    latestDecision: match.latestDecision,
    score: match.score,
    redCards: match.redCards,
    lastUpdatedAt: match.lastUpdatedAt
  };
}

function isGoalSide(side: MatchGoalHighlight["side"] | null, target: "home" | "away") {
  return side === target || side === "both";
}

function AtmosphereLeagueLogo({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <span className="atmosphereLeagueLogo fallback" aria-hidden="true">
        {initial}
      </span>
    );
  }

  return <img className="atmosphereLeagueLogo" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

function isSwipeControlTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(".atmosphereMobileTabs, button, input, textarea, select, a"));
}

function createAixpSparkles(): AixpSparkle[] {
  const batch = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  return Array.from({ length: AIXP_SPARKLE_COUNT }, (_, index) => {
    const floatAroundText = index % 4 === 0;
    const x = floatAroundText ? randomBetween(-6, 106) : randomBetween(18, 82);
    const y = floatAroundText ? randomBetween(-18, 118) : randomBetween(6, 96);

    return {
      id: `${batch}-${index}`,
      x: `${x.toFixed(1)}%`,
      y: `${y.toFixed(1)}%`,
      size: `${randomBetween(3.2, 6.2).toFixed(1)}px`,
      delay: `${Math.round(randomBetween(0, 180))}ms`,
      rotate: `${Math.round(randomBetween(-35, 35))}deg`
    };
  });
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function MobileAtmosphereTabs({
  activeTab,
  onChange,
  sparkles,
  standingsLabel = "Puan"
}: {
  activeTab: MobileAtmosphereTab;
  onChange: (tab: MobileAtmosphereTab) => void;
  sparkles: AixpSparkle[];
  standingsLabel?: string;
}) {
  return (
    <div className="atmosphereMobileTabs atmosphereOverviewOnly" role="tablist" aria-label="Atmosfer mobil sekmeleri">
      {mobileAtmosphereTabs.map((tab) => {
        const className = [activeTab === tab.key ? "active" : "", tab.key === "aixp" ? "aixpSparkTab" : ""].filter(Boolean).join(" ");
        const label = tab.key === "standings" ? standingsLabel : tab.label;

        return (
          <button
            className={className}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-label={label}
            title={label}
            onClick={() => onChange(tab.key)}
            key={tab.key}
          >
            <span className="atmosphereMobileTabLabel">{label}</span>
            {tab.key === "aixp" ? (
              <span className="aixpTabSparkles" aria-hidden="true">
                {sparkles.map((spark) => (
                  <i
                    key={spark.id}
                    style={
                      {
                        "--spark-x": spark.x,
                        "--spark-y": spark.y,
                        "--spark-size": spark.size,
                        "--spark-delay": spark.delay,
                        "--spark-rotate": spark.rotate
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function capitalizeMobileTab(tab: MobileAtmosphereTab) {
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

function capitalizeSwipeDirection(direction: MobileSwipeDirection) {
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

function AtmosphereTeam({
  team,
  side,
  standing,
  form,
  accent,
  goalActive = false
}: {
  team: Team;
  side: "home" | "away";
  standing: MatchDetailStandingRow | null;
  form: NormalizedMatch[];
  accent: string;
  goalActive?: boolean;
}) {
  const teamStyle = { "--team-accent": accent } as CSSProperties;

  return (
    <div className={`atmosphereTeam ${side} ${goalActive ? "goalTeam" : ""}`} style={teamStyle}>
      <TeamLogo src={team.logo} label={team.name} size="lg" />
      <strong title={team.name}>{team.name}</strong>
      <span>{standing?.position ? `${standing.position}. sıra` : `${formScore(form, team.id)} form puanı`}</span>
    </div>
  );
}

function HeroPredictionLine({
  rows,
  homeTeam,
  awayTeam,
  tieInfo
}: {
  rows: PredictionRow[];
  homeTeam: Team;
  awayTeam: Team;
  tieInfo?: KnockoutTieInfo | null;
}) {
  if (rows.length === 0 && !tieInfo) return null;

  const orderedRows = ["home", "draw", "away"]
    .map((key) => rows.find((row) => row.key === key))
    .filter((row): row is PredictionRow => Boolean(row));
  const leader = [...orderedRows].sort((a, b) => b.number - a.number)[0];

  return (
    <section className={`atmosphereHeroPrediction ${leader?.key ?? "neutral"}`} aria-label="aiXp tahmin ve eleme bilgisi">
      {tieInfo ? <span className="atmosphereHeroTieNote">({tieInfo.heroLabel})</span> : null}
      {leader ? (
        <>
          <div className="atmosphereHeroPredictionLabels">
            <span title={homeTeam.name}>{homeTeam.name}</span>
            <strong title={`${leader.team} ${leader.value}`}>
              aiXp: {leader.team} {leader.value}
            </strong>
            <span title={awayTeam.name}>{awayTeam.name}</span>
          </div>
          <div className="atmosphereHeroPredictionRail" aria-hidden="true">
            {orderedRows.map((row) => (
              <i className={row.key} style={{ flexGrow: Math.max(row.number, 4) }} key={row.key} />
            ))}
          </div>
        </>
      ) : null}
    </section>
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

function PressureMeterCard({ match, data }: { match: NormalizedMatch; data: LiveAtmosphereData }) {
  const homeEvents = data.pressure.events.filter((event) => event.side === "home");
  const awayEvents = data.pressure.events.filter((event) => event.side === "away");
  const graphPaths = pressureAreaPaths(data.pressure.series);

  return (
    <section className="atmospherePressureCard" aria-label="Momentum">
      <div className="atmospherePressureHeader">
        <div className="atmospherePressureTeam home">
          <i aria-hidden="true" />
          <span title={match.homeTeam.name}>{match.homeTeam.name}</span>
        </div>
        <div className="atmospherePressureTitle">
          <span>Momentum</span>
          <strong>
            <em>Ev %{data.pressure.homeShare}</em>
            <b>-</b>
            <em>Dep %{data.pressure.awayShare}</em>
          </strong>
        </div>
        <div className="atmospherePressureTeam away">
          <span title={match.awayTeam.name}>{match.awayTeam.name}</span>
          <i aria-hidden="true" />
        </div>
      </div>

      <div className="atmospherePressureEventRail home" aria-hidden="true">
        {homeEvents.map((event) => (
          <PressureEventDot event={event} key={event.key} />
        ))}
      </div>

      <div className={`atmospherePressureGraph ${data.pressure.hasData ? "hasData" : "isEmpty"}`}>
        <svg className="atmospherePressureSvg" viewBox="0 0 900 220" preserveAspectRatio="none" aria-hidden="true">
          <rect className="pressureGraphHalf home" x="0" y="0" width="900" height="110" />
          <rect className="pressureGraphHalf away" x="0" y="110" width="900" height="110" />
          <line className="pressureGraphMidline" x1="0" y1="110" x2="900" y2="110" />
          <line className="pressureGraphHalfline" x1="450" y1="8" x2="450" y2="212" />
          <path className="pressureGraphArea home" d={graphPaths.homeArea} />
          <path className="pressureGraphArea away" d={graphPaths.awayArea} />
          <path className="pressureGraphStroke home" d={graphPaths.homeLine} />
          <path className="pressureGraphStroke away" d={graphPaths.awayLine} />
        </svg>
        <div className="atmospherePressureHalf home">Ev</div>
        <div className="atmospherePressureHalf away">Dep</div>
      </div>

      <div className="atmospherePressureEventRail away" aria-hidden="true">
        {awayEvents.map((event) => (
          <PressureEventDot event={event} key={event.key} />
        ))}
      </div>

      <div className="atmospherePressureAxis" aria-hidden="true">
        <span>0'</span>
        <i />
        <span>45'</span>
        <i />
        <span>90'</span>
      </div>
    </section>
  );
}

function PressureEventDot({ event }: { event: PressureEventMarker }) {
  const style = { left: `${(event.minute / 90) * 100}%` } as CSSProperties;

  return (
    <span className={`pressureEventDot ${event.kind}`} style={style} title={event.label}>
      {renderPressureEventIcon(event.kind)}
    </span>
  );
}

function ComparativePulseCard({ match, data }: { match: NormalizedMatch; data: LiveAtmosphereData }) {
  return (
    <section className="atmosphereComparePulseCard" aria-label="Karşılaştırmalı maç istatistikleri">
      <div className="atmosphereCompareDonuts">
        {data.circles.map((metric) => (
          <ComparisonDonut metric={metric} key={metric.key} />
        ))}
      </div>

      <div className="atmosphereCompareTeams" aria-hidden="true">
        <span title={match.homeTeam.name}>Ev</span>
        <b />
        <span title={match.awayTeam.name}>Dep</span>
      </div>

      <div className="atmosphereCompareLines">
        {data.lines.map((metric) => (
          <ComparisonLine metric={metric} key={metric.key} />
        ))}
      </div>
    </section>
  );
}

function ComparisonDonut({ metric }: { metric: ComparisonMetric }) {
  const style = { "--home-deg": `${shareOfTotal(metric.home, metric.away) * 360}deg` } as CSSProperties;

  return (
    <article className={`atmosphereCompareDonut ${metric.key}`}>
      <span>{metric.label}</span>
      <div className="atmosphereCompareDonutBody">
        <strong>{formatMetricNumber(metric.home)}</strong>
        <div className="atmosphereCompareRing" style={style} aria-hidden="true">
          <em>{renderComparisonCenter(metric.center)}</em>
        </div>
        <strong>{formatMetricNumber(metric.away)}</strong>
      </div>
    </article>
  );
}

function ComparisonLine({ metric }: { metric: LineMetric }) {
  const homeShare = shareOfTotal(metric.home, metric.away) * 100;
  const awayShare = 100 - homeShare;

  return (
    <div className={`atmosphereCompareLine ${metric.key}`}>
      <span className="compareLineIcon home">{renderLineMetricIcon(metric.icon)}</span>
      <strong>{formatMetricNumber(metric.home)}</strong>
      <div className="compareLineCenter">
        <span>{metric.label}</span>
        <div className="compareLineTrack" aria-hidden="true">
          <i style={{ width: `${homeShare}%` }} />
          <b style={{ width: `${awayShare}%` }} />
        </div>
      </div>
      <strong>{formatMetricNumber(metric.away)}</strong>
      <span className="compareLineIcon away">{renderLineMetricIcon(metric.icon)}</span>
    </div>
  );
}

function InsightCard({ item }: { item: InsightRow }) {
  const progressStyle = { "--insight-progress": `${item.progress ?? 0}%` } as CSSProperties;
  const segments = item.segments ?? [];
  const segmentTotal = segments.reduce((total, segment) => total + segment.value, 0);

  return (
    <article className={`atmosphereInsight ${item.kind}`} style={progressStyle}>
      <div className="atmosphereInsightHeader">
        <span>{item.label}</span>
        <strong>{item.value}</strong>
      </div>
      {segments.length > 0 ? (
        <>
          <div className={`atmosphereInsightGraph count${segments.length}`} aria-hidden="true">
            {segments.map((segment) => (
              <i className={segment.key} style={{ flexGrow: segmentTotal > 0 ? Math.max(segment.value, 0.6) : 1 }} key={segment.key} />
            ))}
          </div>
          <div className="atmosphereInsightLegend">
            {segments.map((segment) => (
              <span className={segment.key} key={segment.key}>
                {segment.label} <b>{segment.display}</b>
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="atmosphereInsightGauge" aria-hidden="true">
          <i />
        </div>
      )}
      <p>{item.detail}</p>
    </article>
  );
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

  if (rows.length === 0) {
    return <EmptyAtmosphereState label="İstatistik verisi bekleniyor" />;
  }

  return (
    <div className="atmosphereStatList">
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
      <div className="atmosphereStatTeams">
        <span title={match.homeTeam.name}>{match.homeTeam.name}</span>
        <BarChart3 size={16} />
        <span title={match.awayTeam.name}>{match.awayTeam.name}</span>
      </div>
      {activeRows.length > 0 ? (
        activeRows.slice(0, 14).map((row) => (
          <div className="atmosphereStatRow" key={`${row.period}:${row.name}`}>
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
        ))
      ) : (
        <EmptyAtmosphereState label={`${periodTabs.find((tab) => tab.key === activePeriod)?.label ?? "Periyot"} ayrımı sağlayıcıda yok`} />
      )}
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
    return <EmptyAtmosphereState label="Form gol grafiği için veri bekleniyor" />;
  }

  return (
    <div className="formGoalsGraph" aria-label="Son 5 maç gol formu">
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
  const focusAway = match.awayTeam.id === focusTeamId;

  return (
    <div className={`atmosphereMiniRow ${focusHome ? "focusHome" : focusAway ? "focusAway" : ""}`}>
      <span>{formatShortDate(match.date)}</span>
      <span className="atmosphereMiniTeams">
        <TeamLogo src={match.homeTeam.logo} label={match.homeTeam.name} size="sm" />
        <strong title={`${match.homeTeam.name} - ${match.awayTeam.name}`}>
          {match.homeTeam.name} - {match.awayTeam.name}
        </strong>
      </span>
      <b>{formatScoreline(match)}</b>
    </div>
  );
}

function RecentHeadToHead({ matches, focusTeamId }: { matches: NormalizedMatch[]; focusTeamId: string }) {
  if (matches.length === 0) return null;

  return (
    <div className="atmosphereHeadToHeadList">
      <span>Son mukayeseler</span>
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

function KnockoutTiePanel({
  match,
  tieInfo,
  compact = false
}: {
  match: NormalizedMatch;
  tieInfo: KnockoutTieInfo;
  compact?: boolean;
}) {
  return (
    <div className={`atmosphereKnockoutPanel ${compact ? "compact" : ""}`}>
      <div className="atmosphereKnockoutSummary">
        <span>{tieInfo.stageLabel}</span>
        <strong>{tieInfo.legLabel}</strong>
        <em>{tieInfo.aggregateLabel ?? "Eşleşme dengesi maç içinde netleşecek"}</em>
      </div>

      <div className="atmosphereKnockoutTeams">
        <div>
          <TeamLogo src={match.homeTeam.logo} label={match.homeTeam.name} size="sm" />
          <strong title={match.homeTeam.name}>{match.homeTeam.name}</strong>
        </div>
        <b>{formatScoreline(match)}</b>
        <div>
          <TeamLogo src={match.awayTeam.logo} label={match.awayTeam.name} size="sm" />
          <strong title={match.awayTeam.name}>{match.awayTeam.name}</strong>
        </div>
      </div>

      <div className="atmosphereKnockoutMeta">
        {tieInfo.previousLeg ? (
          <>
            <span>Önceki maç</span>
            <strong>{tieInfo.previousScoreDetail}</strong>
          </>
        ) : (
          <>
            <span>Ayak bilgisi</span>
            <strong>1. ayak görünümü</strong>
          </>
        )}
      </div>
    </div>
  );
}

function FullStandingTable({
  standings,
  homeTeamId,
  awayTeamId,
  countryName
}: {
  standings: MatchDetail["standings"];
  homeTeamId: string;
  awayTeamId: string;
  countryName: string;
}) {
  const groups = standings?.groups.filter((group) => group.rows.length > 0) ?? [];
  if (groups.length === 0) return <EmptyAtmosphereState label="Puan verisi bekleniyor" />;

  return (
    <div className="atmosphereFullStandings">
      {groups.map((group) => (
        <section className="atmosphereFullStandingGroup" key={group.name}>
          {groups.length > 1 ? <strong className="atmosphereStandingGroupTitle">{group.name}</strong> : null}
          <div className="atmosphereFullStandingScroll">
            <div className="atmosphereFullStandingTable">
              <div className="atmosphereFullStandingHead">
                <span />
                <span>#</span>
                <span>Takım</span>
                <span>O</span>
                <span>G</span>
                <span>B</span>
                <span>M</span>
                <span>AG</span>
                <span>YG</span>
                <span>AV</span>
                <span>P</span>
              </div>
              {group.rows
                .slice()
                .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER))
                .map((row) => {
                  const pulse = standingPulseForPosition(row.position, group.rows.length, standings, countryName);
                  const highlighted = row.team.id === homeTeamId || row.team.id === awayTeamId;

                  return (
                    <div className={`atmosphereFullStandingRow ${pulse ?? "neutral"} ${highlighted ? "highlighted" : ""}`} key={`${group.name}:${row.team.id}`}>
                      <span className={`standingPulse ${pulse ?? "neutral"}`} aria-hidden="true" />
                      <span>{row.position ?? "-"}</span>
                      <span className="fullStandingTeam">
                        <TeamLogo src={row.team.logo} label={row.team.name} size="sm" />
                        <strong title={row.team.name}>{row.team.name}</strong>
                      </span>
                      <span>{row.total.games}</span>
                      <span>{row.total.wins}</span>
                      <span>{row.total.draws}</span>
                      <span>{row.total.loses}</span>
                      <span>{row.total.scoredGoals}</span>
                      <span>{row.total.receivedGoals}</span>
                      <span>{formatGoalDifference(row)}</span>
                      <b>{row.points ?? "-"}</b>
                    </div>
                  );
                })}
            </div>
          </div>
        </section>
      ))}
      <div className="standingPulseLegend" aria-label="Puan tablosu renk açıklamaları">
        {standingPulseLabelsForStandings(standings, countryName).map((item) => (
          <span className={item.kind} key={item.kind}>
            <i aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function AtmosphereLineupsView({ match, lineups }: { match: NormalizedMatch; lineups: MatchDetail["lineups"] }) {
  const hasLineup = Boolean(lineups?.home || lineups?.away);
  if (!hasLineup) return <EmptyAtmosphereState label="Diziliş verisi bekleniyor" />;

  return (
    <div className="atmosphereLineupsView">
      <LineupPitchCard fallbackTeam={match.homeTeam} lineup={lineups?.home ?? null} side="home" />
      <LineupPitchCard fallbackTeam={match.awayTeam} lineup={lineups?.away ?? null} side="away" />
    </div>
  );
}

function LineupPitchCard({
  fallbackTeam,
  lineup,
  side
}: {
  fallbackTeam: Team;
  lineup: AtmosphereLineupTeam;
  side: "home" | "away";
}) {
  const team = lineup?.team ?? fallbackTeam;
  const rows = lineup?.initialLineup.filter((row) => row.length > 0) ?? [];
  const substitutes = lineup?.substitutes ?? [];

  return (
    <section className={`atmosphereLineupCard ${side}`}>
      <div className="atmosphereLineupHeader">
        <TeamLogo src={team.logo} label={team.name} size="sm" />
        <div>
          <strong title={team.name}>{team.name}</strong>
          <span>{lineup?.formation ?? "Diziliş bekleniyor"}</span>
        </div>
      </div>

      <div className="atmospherePitchGraphic">
        <span className="atmospherePitchBox top" aria-hidden="true" />
        <span className="atmospherePitchBox bottom" aria-hidden="true" />
        <span className="atmospherePitchCircle" aria-hidden="true" />
        {rows.length > 0 ? (
          <div className="atmospherePitchRows">
            {rows.map((row, rowIndex) => (
              <div className="atmospherePitchRow" style={{ "--lineup-count": row.length } as CSSProperties} key={`${team.id}:line:${rowIndex}`}>
                {row.map((player, playerIndex) => (
                  <PitchPlayer player={player} key={`${player.id ?? player.name}:${rowIndex}:${playerIndex}`} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="atmospherePitchEmpty">Saha dizilişi bekleniyor</div>
        )}
      </div>

      {substitutes.length > 0 ? (
        <div className="atmosphereLineupBench">
          <span>Yedekler</span>
          <div>
            {substitutes.slice(0, 8).map((player, index) => (
              <span title={player.position ?? player.name} key={`${player.id ?? player.name}:bench:${index}`}>
                {player.number !== null ? <b>{player.number}</b> : null}
                {player.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PitchPlayer({ player }: { player: AtmosphereLineupPlayer }) {
  return (
    <span className="atmospherePitchPlayer" title={player.position ?? player.name}>
      <i>{player.number ?? ""}</i>
      <strong>{player.name}</strong>
    </span>
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
              <span>{translatePlayerPosition(player.position)}</span>
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

function buildLiveAtmosphereData(match: NormalizedMatch, detail: MatchDetail | null, rows: StatisticRow[]): LiveAtmosphereData {
  const attacks = readStatisticPair(rows, ["Attacks", "Attack", "Total attacks"]);
  const possession = readStatisticPair(rows, ["Possession", "Ball possession"], { percent: true });
  const corners = readStatisticPair(rows, ["Corners", "Corner kicks"]);
  const yellowCards = readStatisticPair(rows, ["Yellow cards", "Yellow card"]);
  const redCards = withPairFallback(readStatisticPair(rows, ["Red cards", "Red card"]), {
    home: match.redCards.home,
    away: match.redCards.away
  });
  const shotsOnTarget = readStatisticPair(rows, ["Shots on target", "Shots on goal"]);
  const bigChancesCreated = readStatisticPair(rows, [
    "Big chances created",
    "Big chances",
    "Clear cut chances",
    "Created big chances",
    "Yaratilan net firsat",
    "Net firsat"
  ]);
  const directDangerousAttacks = readStatisticPair(rows, [
    "Dangerous attacks",
    "Dangerous attack",
    "Danger attacks",
    "Dangerous Attacks",
    "Tehlikeli attacks",
    "Tehlikeli atak",
    "Tehlikeli hücum",
    "Tehlikeli hucum"
  ]);
  const dangerousAttacks = directDangerousAttacks.found ? directDangerousAttacks : addStatisticPairs(bigChancesCreated, shotsOnTarget);
  const shotsOffTarget = readStatisticPair(rows, ["Shots off target", "Shots wide", "Missed shots"]);
  const blockedShots = readStatisticPair(rows, ["Blocked shots", "Shots blocked"]);
  const missedBlockedShots = addStatisticPairs(shotsOffTarget, blockedShots);
  const totalShotsSource = readStatisticPair(rows, ["Total shots", "Shots total", "Shots"]);
  const totalShots = totalShotsSource.found ? totalShotsSource : addStatisticPairs(shotsOnTarget, missedBlockedShots);
  const events = buildPressureEvents(detail?.events ?? [], match);
  const goalPair = goalsFromMatchAndEvents(match, events);
  const pressureScores = {
    home:
      possession.home * 0.42 +
      corners.home * 4.2 +
      attacks.home * 0.54 +
      dangerousAttacks.home * 1.38 +
      totalShots.home * 2.85 +
      shotsOnTarget.home * 2.2 +
      goalPair.home * 5,
    away:
      possession.away * 0.42 +
      corners.away * 4.2 +
      attacks.away * 0.54 +
      dangerousAttacks.away * 1.38 +
      totalShots.away * 2.85 +
      shotsOnTarget.away * 2.2 +
      goalPair.away * 5
  };
  const hasData =
    [possession, corners, attacks, dangerousAttacks, totalShots, yellowCards, redCards, shotsOnTarget, missedBlockedShots].some(
      (pair) => pair.found && pair.home + pair.away > 0
    ) || events.length > 0;
  const homeShare = Math.round(shareOfTotal(pressureScores.home, pressureScores.away) * 100);

  return {
    pressure: {
      homeShare,
      awayShare: 100 - homeShare,
      series: buildPressureSeries(match, events, pressureScores, hasData),
      events,
      hasData
    },
    circles: [
      { key: "attack", label: "Atak", home: attacks.home, away: attacks.away, center: "attack" },
      { key: "danger", label: "Tehlikeli Atak", home: dangerousAttacks.home, away: dangerousAttacks.away, center: "danger" },
      { key: "possession", label: "Topa Sahip Olma", home: possession.home, away: possession.away, center: "possession" }
    ],
    lines: [
      { key: "corner", label: "Korner", home: corners.home, away: corners.away, icon: "corner" },
      { key: "yellow", label: "Sarı Kart", home: yellowCards.home, away: yellowCards.away, icon: "yellow" },
      { key: "red", label: "Kırmızı Kart", home: redCards.home, away: redCards.away, icon: "red" },
      { key: "target", label: "İsabetli Şut", home: shotsOnTarget.home, away: shotsOnTarget.away, icon: "target" },
      { key: "missed", label: "İsabetsiz / Engellenen Şut", home: missedBlockedShots.home, away: missedBlockedShots.away, icon: "missed" }
    ]
  };
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

function statisticRowsForPeriod(rows: StatisticRow[], period: StatisticPeriod) {
  return buildStatisticPeriodTabs(rows).find((tab) => tab.key === period)?.rows ?? [];
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

function readStatisticPair(
  rows: StatisticRow[],
  aliases: string[],
  options: { percent?: boolean } = {}
): StatisticPair {
  const normalizedAliases = aliases.map(normalizeStatisticLookup);
  const row = rows.find((item) => normalizedAliases.includes(normalizeStatisticLookup(item.name)));

  if (!row) {
    return { home: 0, away: 0, found: false };
  }

  return {
    home: normalizeStatisticPairNumber(row.name, row.homeNumber, row.homeDisplay, options.percent),
    away: normalizeStatisticPairNumber(row.name, row.awayNumber, row.awayDisplay, options.percent),
    found: true
  };
}

function normalizeStatisticPairNumber(name: string, value: number, display: string, percent = false) {
  if (!Number.isFinite(value)) return 0;

  if (percent || normalizeStatisticLookup(name).includes("possession")) {
    const displayNumber = parseDisplayNumber(display);
    if (display.includes("%") && displayNumber !== null) return clamp(displayNumber, 0, 100);
    return clamp(value <= 1 ? value * 100 : value, 0, 100);
  }

  return Math.max(0, value);
}

function withPairFallback(pair: StatisticPair, fallback: { home: number; away: number }): StatisticPair {
  if (pair.found) return pair;

  return {
    home: Math.max(0, fallback.home),
    away: Math.max(0, fallback.away),
    found: fallback.home + fallback.away > 0
  };
}

function addStatisticPairs(first: StatisticPair, second: StatisticPair): StatisticPair {
  return {
    home: first.home + second.home,
    away: first.away + second.away,
    found: first.found || second.found
  };
}

function pressureAreaPaths(series: PressurePoint[]) {
  const width = 900;
  const midline = 110;
  const amplitude = 96;
  const homePoints = pressurePathPoints(series, "home", width, midline, amplitude);
  const awayPoints = pressurePathPoints(series, "away", width, midline, amplitude);

  return {
    homeArea: areaPath(homePoints, width, midline),
    awayArea: areaPath(awayPoints, width, midline),
    homeLine: linePath(homePoints),
    awayLine: linePath(awayPoints)
  };
}

function pressurePathPoints(series: PressurePoint[], side: "home" | "away", width: number, midline: number, amplitude: number) {
  const lastIndex = Math.max(1, series.length - 1);

  return series.map((point, index) => {
    const value = side === "home" ? point.home : point.away;
    const distance = (clamp(value, 0, 100) / 100) * amplitude;

    return {
      x: (index / lastIndex) * width,
      y: side === "home" ? midline - distance : midline + distance
    };
  });
}

function areaPath(points: { x: number; y: number }[], width: number, midline: number) {
  if (points.length === 0) return `M 0 ${midline} L ${width} ${midline} Z`;
  return `M 0 ${midline} ${smoothLinePath(points)} L ${width} ${midline} Z`;
}

function linePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ${smoothLinePath(points).replace(/^L\s+[\d.-]+\s+[\d.-]+/, "")}`;
}

function smoothLinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  let path = `L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];
    const midX = (previous.x + current.x) / 2;
    const midY = (previous.y + current.y) / 2;
    path += ` Q ${previous.x.toFixed(1)} ${previous.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  path += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return path;
}

function buildPressureEvents(events: MatchDetailEvent[], match: NormalizedMatch): PressureEventMarker[] {
  return events
    .map((event, index) => {
      const side = eventSide(event, match);
      const minute = parseEventMinute(event.time);
      if (side !== "home" && side !== "away") return null;
      if (minute === null) return null;

      const kind = pressureEventKind(event.type);
      const label = `${minute}' ${eventLabels[event.type] ?? event.type}`;
      return {
        key: `${side}:${minute}:${event.type}:${event.team.id}:${index}`,
        minute,
        side,
        kind,
        label
      };
    })
    .filter((event): event is PressureEventMarker => Boolean(event));
}

function buildPressureSeries(
  match: NormalizedMatch,
  events: PressureEventMarker[],
  scores: { home: number; away: number },
  hasData: boolean
): PressurePoint[] {
  const homeSeed = hashString(match.homeTeam.id || match.homeTeam.name) % 19;
  const awaySeed = hashString(match.awayTeam.id || match.awayTeam.name) % 23;
  const homeShare = shareOfTotal(scores.home, scores.away);
  const awayShare = 1 - homeShare;
  const currentMinute = pressureCurrentMinute(match);
  const homeDominance = clamp((homeShare - 0.5) * 2, 0, 1);
  const awayDominance = clamp((awayShare - 0.5) * 2, 0, 1);
  const homeAmplitude = hasData ? clamp(Math.sqrt(Math.max(scores.home, 1)) * 5.4 + homeDominance * 18, 18, 66) : 14;
  const awayAmplitude = hasData ? clamp(Math.sqrt(Math.max(scores.away, 1)) * 5.4 + awayDominance * 18, 18, 66) : 14;

  return Array.from({ length: 90 }, (_, index) => {
    const minute = index + 1;
    const future = minute > currentMinute;
    const futureFactor = future ? 0.34 : 1;
    const idle = hasData ? 0 : 10;
    const homeWave = rhythmicPressure(minute, homeSeed, 0.34) * homeAmplitude;
    const awayWave = rhythmicPressure(minute, awaySeed, 0.41) * awayAmplitude;
    const homeEventBoost = eventPressureBoost(minute, events, "home");
    const awayEventBoost = eventPressureBoost(minute, events, "away");
    const homeBase = hasData ? 7 + homeShare * 46 + homeDominance * 12 : homeWave;
    const awayBase = hasData ? 7 + awayShare * 46 + awayDominance * 12 : awayWave;
    const home = (idle + (hasData ? homeBase + homeWave + homeEventBoost : homeWave)) * futureFactor;
    const away = (idle + (hasData ? awayBase + awayWave + awayEventBoost : awayWave)) * futureFactor;

    return {
      minute,
      home: clamp(home, future ? 3 : 6, 94),
      away: clamp(away, future ? 3 : 6, 94),
      future
    };
  });
}

function pressureCurrentMinute(match: NormalizedMatch) {
  if (match.status.group === "upcoming") return 0;
  if (match.status.group !== "live") return 90;

  const minute = match.status.minute ?? 1;
  const description = match.status.description.toLowerCase();
  if (description === "second half") {
    return clamp(minute <= 45 ? 45 + Math.max(1, minute) : minute, 1, 90);
  }

  return clamp(minute, 1, 90);
}

function rhythmicPressure(minute: number, seed: number, pace: number) {
  const primary = Math.sin(minute * pace + seed * 0.37);
  const secondary = Math.sin(minute * (pace * 0.43) + seed * 0.73);
  return clamp(0.52 + primary * 0.28 + secondary * 0.2, 0.08, 1);
}

function eventPressureBoost(minute: number, events: PressureEventMarker[], side: "home" | "away") {
  return events
    .filter((event) => event.side === side)
    .reduce((total, event) => {
      const distance = Math.abs(minute - event.minute);
      if (distance > 9) return total;
      return total + eventPressureWeight(event.kind) * Math.exp(-(distance * distance) / 18);
    }, 0);
}

function eventPressureWeight(kind: PressureEventKind) {
  if (kind === "goal") return 38;
  if (kind === "goalCancelled") return 16;
  if (kind === "penalty") return 30;
  if (kind === "red") return 20;
  if (kind === "corner") return 16;
  if (kind === "var") return 12;
  if (kind === "yellow") return 7;
  if (kind === "substitution") return 4;
  return 5;
}

function goalsFromMatchAndEvents(match: NormalizedMatch, events: PressureEventMarker[]): StatisticPair {
  const eventGoals = events.reduce(
    (total, event) => {
      if (event.kind !== "goal") return total;
      return event.side === "home" ? { ...total, home: total.home + 1 } : { ...total, away: total.away + 1 };
    },
    { home: 0, away: 0 }
  );

  return {
    home: Math.max(match.score.home ?? 0, eventGoals.home),
    away: Math.max(match.score.away ?? 0, eventGoals.away),
    found: (match.score.home ?? 0) + (match.score.away ?? 0) + eventGoals.home + eventGoals.away > 0
  };
}

function pressureEventKind(type: string): PressureEventKind {
  const normalized = normalizeStatisticLookup(type);
  if (
    (normalized.includes("cancel") || normalized.includes("disallow") || normalized.includes("no goal") || normalized.includes("iptal")) &&
    (normalized.includes("goal") || normalized.includes("gol"))
  ) {
    return "goalCancelled";
  }
  if (normalized.includes("red")) return "red";
  if (normalized.includes("yellow")) return "yellow";
  if (normalized.includes("corner") || normalized.includes("korner") || normalized.includes("kose")) return "corner";
  if (normalized.includes("penalty") || normalized.includes("penalti")) return "penalty";
  if (normalized.includes("goal") || normalized.includes("gol")) return "goal";
  if (normalized.includes("var") || normalized.includes("video assistant")) return "var";
  if (normalized.includes("substitut") || normalized.includes("oyuncu") || normalized.includes("degis")) return "substitution";
  return "event";
}

function renderPressureEventIcon(kind: PressureEventKind) {
  if (kind === "yellow" || kind === "red") return <span className={`pressureCardIcon ${kind}`} />;
  if (kind === "goal") return <span className="pressureBallIcon">⚽</span>;
  if (kind === "goalCancelled") return <span className="pressureBallIcon cancelled">⚽</span>;
  if (kind === "corner") return <Flag size={8} />;
  if (kind === "substitution") return <RefreshCw size={8} />;
  if (kind === "var") return <Sparkles size={8} />;
  if (kind === "event") return <Activity size={8} />;
  return <Target size={8} />;
}

function renderComparisonCenter(kind: ComparisonMetricKind) {
  if (kind === "possession") return <Percent size={28} />;
  return <ChevronsRight size={kind === "danger" ? 31 : 29} strokeWidth={kind === "danger" ? 3 : 2.6} />;
}

function renderLineMetricIcon(kind: LineMetricKind) {
  if (kind === "yellow" || kind === "red") return <span className={`compareCardIcon ${kind}`} />;
  if (kind === "corner") return <Flag size={18} />;
  if (kind === "target") return <Target size={18} />;
  return <Activity size={18} />;
}

function shareOfTotal(home: number, away: number) {
  const total = home + away;
  if (!Number.isFinite(total) || total <= 0) return 0.5;
  return clamp(home / total, 0, 1);
}

function formatMetricNumber(value: number) {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000) {
    return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1, notation: "compact" }).format(rounded);
  }

  return String(rounded);
}

function parseEventMinute(value: string | null) {
  if (!value) return null;
  const match = String(value).match(/(\d+)(?:\s*\+\s*(\d+))?/);
  if (!match) return null;

  const minute = Number(match[1]) + Number(match[2] ?? 0);
  if (!Number.isFinite(minute)) return null;
  return clamp(minute, 0, 90);
}

function parseDisplayNumber(value: string) {
  const parsed = Number(String(value).replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildPredictionRows(match: NormalizedMatch, prediction: MatchDetailPrediction | null): PredictionRow[] {
  if (!prediction) return [];

  return [
    { key: "home", label: "1", team: match.homeTeam.name, value: prediction.probabilities.home },
    { key: "draw", label: "X", team: "Beraberlik", value: prediction.probabilities.draw },
    { key: "away", label: "2", team: match.awayTeam.name, value: prediction.probabilities.away }
  ]
    .map((item) => ({ ...item, number: parsePercent(item.value) }))
    .filter((item): item is PredictionRow => item.number !== null && item.value !== null);
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
  stats: StatisticRow[],
  predictions: ReturnType<typeof buildPredictionRows>
): InsightRow[] {
  const homeFormScore = formScore(detail?.form?.home ?? [], match.homeTeam.id);
  const awayFormScore = formScore(detail?.form?.away ?? [], match.awayTeam.id);
  const h2h = summarizeResults((detail?.headToHead ?? []).filter((item) => item.id !== match.id), match.homeTeam, match.awayTeam);
  const shots = stats.find((row) => row.name === "Shots on target") ?? stats.find((row) => row.name === "Total shots");
  const leader = predictions.length > 0 ? [...predictions].sort((a, b) => b.number - a.number)[0] : null;
  const statusProgress = match.status.group === "finished" ? 100 : match.status.group === "live" ? Math.min(100, Math.max(8, match.status.minute ?? 8)) : 22;
  const h2hTotal = h2h.homeWins + h2h.draws + h2h.awayWins;
  const dataSegments = shots
    ? [
        { key: "home" as const, label: "Ev", value: shots.homeNumber, display: shots.homeDisplay },
        { key: "away" as const, label: "Dep", value: shots.awayNumber, display: shots.awayDisplay }
      ]
    : predictions.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.number,
        display: item.value
      }));
  const dataDetail = shots
    ? shots.homeNumber === shots.awayNumber
      ? "İki takım veri çizgisinde dengede"
      : `${shots.homeNumber > shots.awayNumber ? match.homeTeam.name : match.awayTeam.name} veri çizgisinde önde`
    : leader
      ? `${leader.team} olasılık lideri`
      : "Veri geldikçe sinyal üretilecek";

  return [
    {
      label: "Durum",
      value: formatStatus(match),
      detail: match.status.group === "live" ? "Canlı veri ritmi açık" : match.status.group === "finished" ? "Maç sonrası analiz görünümü" : "Maç öncesi hazırlık görünümü",
      kind: "status",
      progress: statusProgress
    },
    {
      label: "Form",
      value: `${homeFormScore} - ${awayFormScore}`,
      detail: homeFormScore === awayFormScore ? "Son maç formu dengede" : `${homeFormScore > awayFormScore ? match.homeTeam.name : match.awayTeam.name} son maçlarda daha yüksek puan topladı`,
      kind: "form",
      segments: [
        { key: "home", label: "Ev", value: homeFormScore, display: `${homeFormScore}` },
        { key: "away", label: "Dep", value: awayFormScore, display: `${awayFormScore}` }
      ]
    },
    {
      label: "Mukayese",
      value: `${h2h.homeWins}-${h2h.draws}-${h2h.awayWins}`,
      detail: h2hTotal > 0 ? "Ev sahibi, beraberlik ve deplasman galibiyet dağılımı" : "Geçmiş eşleşme verisi bekleniyor",
      kind: "comparison",
      segments: [
        { key: "home", label: "Ev", value: h2h.homeWins, display: `${h2h.homeWins}G` },
        { key: "draw", label: "X", value: h2h.draws, display: `${h2h.draws}B` },
        { key: "away", label: "Dep", value: h2h.awayWins, display: `${h2h.awayWins}G` }
      ]
    },
    {
      label: shots ? translateStatisticLabel(shots.name) : "aiXp",
      value: shots ? `${shots.homeDisplay} - ${shots.awayDisplay}` : leader?.value ?? "-",
      detail: dataDetail,
      kind: shots ? "data" : "aixp",
      segments: dataSegments
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

function buildKnockoutTieInfo(match: NormalizedMatch, h2hMatches: NormalizedMatch[]): KnockoutTieInfo | null {
  if (!isKnockoutMatch(match)) return null;

  const previousLeg = findPreviousKnockoutLeg(match, h2hMatches);
  const previousScoreLabel = previousLeg ? compactKnownScore(previousLeg) : null;
  const previousScoreDetail = previousLeg ? detailedKnownScore(previousLeg) : null;
  const stageLabel = formatAtmosphereStageLabel(match.round, match.league.name) ?? "Eleme";
  const legLabel = previousLeg ? "2. Ayak" : "1. Ayak";

  return {
    stageLabel,
    legLabel,
    heroLabel: previousScoreLabel ? `Önceki skor: ${previousScoreLabel}` : legLabel,
    previousLeg,
    previousScoreLabel,
    previousScoreDetail,
    aggregateLabel: previousLeg ? aggregateTieLabel(match, previousLeg) : null
  };
}

function isKnockoutMatch(match: NormalizedMatch) {
  const value = normalizeTeamName(`${match.round ?? ""} ${match.league.name}`);
  return /\b(playoff|playoffs|play-off|play-offs|promotion|relegation|knockout|qualification|qualifying|elimination|eleme|final|semi|quarter|round of|last 16|last 32|son 16|son 32|yari final|ceyrek final)\b/.test(value);
}

function findPreviousKnockoutLeg(match: NormalizedMatch, h2hMatches: NormalizedMatch[]) {
  return h2hMatches
    .filter((item) => item.timestamp < match.timestamp)
    .filter((item) => item.status.group === "finished")
    .filter((item) => isKnownScore(item))
    .filter((item) => isSamePairing(match, item))
    .filter((item) => item.league.id === match.league.id || normalizeTeamName(item.league.name) === normalizeTeamName(match.league.name))
    .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
}

function isSamePairing(match: NormalizedMatch, candidate: NormalizedMatch) {
  const pair = new Set([match.homeTeam.id, match.awayTeam.id]);
  return pair.has(candidate.homeTeam.id) && pair.has(candidate.awayTeam.id);
}

function isKnownScore(match: NormalizedMatch) {
  return typeof match.score.home === "number" && typeof match.score.away === "number";
}

function compactKnownScore(match: NormalizedMatch) {
  if (!isKnownScore(match)) return null;
  return `${match.score.home}-${match.score.away}`;
}

function detailedKnownScore(match: NormalizedMatch) {
  const score = compactKnownScore(match);
  if (!score) return null;
  return `${match.homeTeam.name} ${score} ${match.awayTeam.name}`;
}

function aggregateTieLabel(match: NormalizedMatch, previousLeg: NormalizedMatch) {
  const homeTotal = scoreForTeam(previousLeg, match.homeTeam.id) + scoreForTeam(match, match.homeTeam.id);
  const awayTotal = scoreForTeam(previousLeg, match.awayTeam.id) + scoreForTeam(match, match.awayTeam.id);
  return `Toplam: ${match.homeTeam.name} ${homeTotal}-${awayTotal} ${match.awayTeam.name}`;
}

function scoreForTeam(match: NormalizedMatch, teamId: string) {
  if (!isKnownScore(match)) return 0;
  if (match.homeTeam.id === teamId) return match.score.home ?? 0;
  if (match.awayTeam.id === teamId) return match.score.away ?? 0;
  return 0;
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

function standingPulseForPosition(position: number | null, rowCount: number, standings?: MatchDetail["standings"], countryName = ""): StandingPulseKind | null {
  if (!position || rowCount < 4) return null;

  const rule = standingZoneRule(standings ?? null, rowCount, countryName);
  if (rule.relegation && position > rowCount - rule.relegation) return "relegation";
  if (rule.champions && position <= rule.champions) return "champions";
  if (rule.promotion && position <= rule.promotion) return "promotion";
  if (rule.europa && position <= (rule.champions ?? 0) + rule.europa) return "europa";
  if (rule.conference && position <= (rule.champions ?? 0) + (rule.europa ?? 0) + rule.conference) return "conference";
  if (rule.playoffFrom && rule.playoffTo && position >= rule.playoffFrom && position <= Math.min(rule.playoffTo, rowCount - (rule.relegation ?? 0))) return "playoff";

  return null;
}

function standingPulseLabelsForStandings(standings: MatchDetail["standings"], countryName = "") {
  const rowCount = standings?.groups[0]?.rows.length ?? 0;
  const rule = standingZoneRule(standings, rowCount, countryName);
  const promotionLabel = standingPromotionLabel(standings, countryName);
  const continentalLabels = standingContinentalLabels(countryName);
  const labels: { kind: StandingPulseKind; label: string }[] = [];

  if (rule.champions) labels.push({ kind: "champions", label: continentalLabels.primary });
  if (rule.promotion) labels.push({ kind: "promotion", label: promotionLabel });
  if (rule.europa) labels.push({ kind: "europa", label: continentalLabels.secondary });
  if (rule.conference) labels.push({ kind: "conference", label: continentalLabels.tertiary });
  if (rule.playoffFrom && rule.playoffTo) labels.push({ kind: "playoff", label: promotionLabel.includes("Yükselme") ? "Yükselme playoff" : "Playoff" });
  if (rule.relegation) labels.push({ kind: "relegation", label: "Düşme hattı" });

  return labels;
}

function standingZoneRule(standings: MatchDetail["standings"], rowCount: number, countryName = ""): StandingZoneRule {
  const league = normalizeTeamName(standings?.league.name ?? "");
  const country = normalizeTeamName(countryName);
  const haystack = `${league} ${country}`;

  if (isCupOrFriendlyLeague(haystack)) return {};

  if (isSecondTierLeague(haystack)) {
    if (country.includes("brazil") || country.includes("brasil") || league.includes("serie b") || league.includes("serie-b")) {
      return { promotion: 2, playoffFrom: 3, playoffTo: 6, relegation: 4 };
    }

    if (country.includes("turkey") || country.includes("turkiye")) {
      return { promotion: 2, playoffFrom: 3, playoffTo: Math.min(7, rowCount - 1), relegation: 4 };
    }

    if (league.includes("championship")) return { promotion: 2, playoffFrom: 3, playoffTo: 6, relegation: 3 };

    if (country.includes("germany") || country.includes("austria")) return { promotion: 2, playoffFrom: 3, playoffTo: 3, relegation: 2 };

    if (rowCount >= 16) return { promotion: 2, playoffFrom: 3, playoffTo: 6, relegation: 3 };
    return { promotion: 1, playoffFrom: 2, playoffTo: Math.min(4, rowCount - 1), relegation: 2 };
  }

  if (country.includes("usa") || country.includes("united states") || country.includes("canada")) {
    return { playoffFrom: 1, playoffTo: Math.min(9, rowCount) };
  }

  if (country.includes("mexico")) {
    return { playoffFrom: 1, playoffTo: Math.min(10, rowCount) };
  }

  if (country.includes("brazil") || country.includes("brasil")) {
    if (rowCount >= 18) return { champions: 6, europa: 6, relegation: 4 };
    return { champions: 4, europa: 2, relegation: 2 };
  }

  if (country.includes("argentina")) {
    return rowCount >= 20 ? { champions: 5, europa: 5, relegation: 2 } : { champions: 3, europa: 3, relegation: 1 };
  }

  if (country.includes("turkey") || country.includes("turkiye")) {
    return rowCount >= 16 ? { champions: 2, europa: 1, conference: 1, relegation: 4 } : { champions: 1, europa: 1, conference: 1, relegation: 2 };
  }

  if (country.includes("england") || country.includes("spain") || country.includes("italy") || country.includes("germany")) {
    return { champions: 4, europa: 1, conference: 1, relegation: 3 };
  }

  if (country.includes("france")) {
    return { champions: 3, europa: 1, conference: 1, relegation: 2 };
  }

  if (country.includes("netherlands") || country.includes("portugal") || country.includes("belgium") || country.includes("scotland")) {
    return { champions: 2, europa: 1, conference: 1, relegation: 2 };
  }

  if (isAsianLeague(country)) {
    return rowCount >= 14 ? { champions: 3, europa: 1, relegation: 2 } : { champions: 2, relegation: 1 };
  }

  if (isAfricanLeague(country)) {
    return rowCount >= 14 ? { champions: 2, europa: 1, relegation: 2 } : { champions: 1, relegation: 1 };
  }

  if (rowCount >= 18) {
    return { champions: 4, europa: 1, conference: 1, relegation: 3 };
  }

  if (rowCount >= 14) {
    return { champions: 2, europa: 1, conference: 1, relegation: 2 };
  }

  if (rowCount >= 10) {
    return { champions: 1, europa: 1, relegation: 1 };
  }

  return { champions: 1, relegation: 1 };
}

function standingPromotionLabel(standings: MatchDetail["standings"], countryName = "") {
  const name = `${normalizeTeamName(standings?.league.name ?? "")} ${normalizeTeamName(countryName)}`;
  if (isSecondTierLeague(name)) return "Yükselme";
  return "Üst sıra";
}

function standingContinentalLabels(countryName: string) {
  const country = normalizeTeamName(countryName);
  if (country.includes("brazil") || country.includes("brasil") || country.includes("argentina") || country.includes("chile") || country.includes("colombia") || country.includes("uruguay") || country.includes("paraguay") || country.includes("peru") || country.includes("ecuador") || country.includes("bolivia") || country.includes("venezuela")) {
    return { primary: "Libertadores", secondary: "Sudamericana", tertiary: "Kıta kupası" };
  }

  if (country.includes("mexico") || country.includes("usa") || country.includes("canada")) {
    return { primary: "CONCACAF", secondary: "Playoff", tertiary: "Kupa" };
  }

  if (isAsianLeague(country)) {
    return { primary: "AFC Şampiyonlar", secondary: "AFC Kupası", tertiary: "Kıta kupası" };
  }

  if (isAfricanLeague(country)) {
    return { primary: "CAF Şampiyonlar", secondary: "CAF Konfederasyon", tertiary: "Kıta kupası" };
  }

  return { primary: "Şampiyonlar Ligi", secondary: "Avrupa Ligi", tertiary: "Konferans / Kupa" };
}

function isSecondTierLeague(value: string) {
  return /\b(serie b|serie-b|championship|segunda|primera b|first division b|1st division b|premier league 2|tff 1\.?\s*lig)\b/.test(value)
    || /\b(liga|ligue|division|bundesliga|league|lig|serie)\s*2\b/.test(value)
    || /\b2\.?\s*(liga|ligue|division|bundesliga|league|lig)\b/.test(value)
    || /\bturkey\s+1\.?\s*lig\b/.test(value)
    || /\b1\.?\s*lig\s+turkey\b/.test(value);
}

function isCupOrFriendlyLeague(value: string) {
  return /\b(cup|kupa|cop[aă]|taça|taca|pokal|super cup|friendlies|friendly|playoff|play-off|u19|u20|u21|women)\b/.test(value);
}

function isAsianLeague(country: string) {
  return /\b(saudi arabia|qatar|united arab emirates|uae|japan|south korea|korea republic|china|iran|iraq|india|australia|indonesia|thailand|malaysia|vietnam|uzbekistan)\b/.test(country);
}

function isAfricanLeague(country: string) {
  return /\b(egypt|morocco|tunisia|algeria|south africa|nigeria|ghana|cameroon|senegal|ivory coast|cote d ivoire|kenya|tanzania)\b/.test(country);
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

function formatCompactScoreline(match: NormalizedMatch) {
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

function formatLeagueTitleRound(value: string) {
  const roundWithWeek = value.match(/^(.+?)\s*-\s*(\d+)$/);
  if (roundWithWeek) return `${translateRoundStage(roundWithWeek[1])}, ${roundWithWeek[2]}. Hafta`;

  return formatRound(value);
}

function formatAtmosphereStageLabel(round: string | null, leagueName: string) {
  const source = round?.trim();
  if (source) {
    const roundWithWeek = source.match(/^(.+?)\s*-\s*\d+$/);
    const stage = roundWithWeek?.[1]?.trim() || source;
    return translateRoundStage(stage);
  }

  if (isFriendlyStage(leagueName)) return "Hazırlık Maçı";
  return null;
}

function translateRoundStage(value: string) {
  if (isFriendlyStage(value)) return "Hazırlık Maçı";

  const labels: Record<string, string> = {
    "Regular Season": "Normal Sezon",
    "Relegation Group": "Düşme Grubu",
    "Championship Round": "Şampiyonluk Turu",
    "Semi-finals": "Yarı Final",
    "Semi Finals": "Yarı Final",
    "Semi Final": "Yarı Final",
    "Quarter-finals": "Çeyrek Final",
    "Quarter Finals": "Çeyrek Final",
    "Quarter Final": "Çeyrek Final",
    "Round of 16": "Son 16",
    "Group Stage": "Grup Aşaması",
    "Preliminary Round": "Ön Eleme Turu",
    "Qualification Round": "Eleme Turu",
    Final: "Final"
  };

  return labels[value] ?? value;
}

function isFriendlyStage(value: string) {
  const normalized = normalizeTeamName(value).replace(/[^a-z0-9]+/g, " ").trim();
  return /\b(friendlies|friendly|pre season|preseason|club friendly|club friendlies)\b/.test(normalized);
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
  return `${translatePlayerStatName(stat.name)}: ${stat.value}`;
}

function translatePlayerPosition(position: string | null) {
  if (!position) return "Oyuncu";
  const normalized = position.trim().toLowerCase();
  const labels: Record<string, string> = {
    attacker: "Forvet",
    forward: "Forvet",
    striker: "Santrfor",
    midfielder: "Orta saha",
    defender: "Defans",
    goalkeeper: "Kaleci",
    keeper: "Kaleci",
    coach: "Teknik direktör"
  };

  return labels[normalized] ?? position;
}

function translatePlayerStatName(name: string) {
  const normalized = name.trim().toLowerCase();
  const labels: Record<string, string> = {
    goals: "Gol",
    goal: "Gol",
    assists: "Asist",
    assist: "Asist",
    tackles: "Top kapma",
    tackle: "Top kapma",
    saves: "Kurtarış",
    save: "Kurtarış",
    shots: "Şut",
    "shots on target": "İsabetli şut",
    passes: "Pas",
    "key passes": "Kilit pas",
    rating: "Puan",
    minutes: "Dakika",
    appearances: "Maç",
    cards: "Kart",
    "yellow cards": "Sarı kart",
    "red cards": "Kırmızı kart"
  };

  return labels[normalized] ?? translateStatisticLabel(name);
}

function useTeamAccent(team: Team) {
  const fallback = useMemo(() => teamAccentFallback(team.name), [team.name]);
  const [accent, setAccent] = useState(fallback);

  useEffect(() => {
    setAccent(fallback);
    if (!team.logo) return;

    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      const dominant = extractDominantImageColor(image);
      if (!cancelled && dominant) setAccent(dominant);
    };
    image.onerror = () => {
      if (!cancelled) setAccent(fallback);
    };
    image.src = team.logo;

    return () => {
      cancelled = true;
    };
  }, [fallback, team.logo]);

  return accent;
}

function normalizeLightAccent(accent: string, colorMode: "dark" | "light") {
  if (colorMode !== "light" || !isYellowAccent(accent)) return accent;
  return "#f97316";
}

function isYellowAccent(accent: string) {
  const rgb = parseAccentColor(accent);
  if (!rgb) return false;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    if (max === g) hue = 60 * ((b - r) / delta + 2);
    if (max === b) hue = 60 * ((r - g) / delta + 4);
  }

  if (hue < 0) hue += 360;
  return hue >= 34 && hue <= 74 && saturation >= 0.35 && lightness >= 0.32;
}

function parseAccentColor(accent: string) {
  const value = accent.trim().toLowerCase();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split("").map((part) => `${part}${part}`).join("") : hex[1];
    return {
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16)
    };
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/);
  if (!rgb) return null;

  const parts = rgb[1]
    .replace(/\//g, " ")
    .split(/[,\s]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => Number.parseFloat(part));

  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  return { r: parts[0], g: parts[1], b: parts[2] };
}

function extractDominantImageColor(image: HTMLImageElement) {
  try {
    const canvas = document.createElement("canvas");
    const size = 36;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { r: number; g: number; b: number; score: number }>();

    for (let index = 0; index < pixels.length; index += 16) {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];
      if (a < 96) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lightness = (max + min) / 510;
      const saturation = max === 0 ? 0 : (max - min) / max;
      if (lightness > 0.94 || lightness < 0.08 || saturation < 0.18) continue;

      const bucketR = Math.round(r / 24) * 24;
      const bucketG = Math.round(g / 24) * 24;
      const bucketB = Math.round(b / 24) * 24;
      const key = `${bucketR}:${bucketG}:${bucketB}`;
      const score = (0.35 + saturation) * (1 - Math.abs(lightness - 0.52) * 0.55);
      const current = buckets.get(key);

      if (current) {
        current.r += r * score;
        current.g += g * score;
        current.b += b * score;
        current.score += score;
      } else {
        buckets.set(key, { r: r * score, g: g * score, b: b * score, score });
      }
    }

    const dominant = [...buckets.values()].sort((a, b) => b.score - a.score)[0];
    if (!dominant) return null;

    const r = Math.round(dominant.r / dominant.score);
    const g = Math.round(dominant.g / dominant.score);
    const b = Math.round(dominant.b / dominant.score);
    return `rgb(${r} ${g} ${b})`;
  } catch {
    return null;
  }
}

function teamAccentFallback(name: string) {
  const normalized = normalizeTeamName(name);
  const knownAccents: Array<[string, string]> = [
    ["dortmund", "#f6d20a"],
    ["frankfurt", "#d71920"],
    ["manchester city", "#6cabdd"],
    ["manchester united", "#da291c"],
    ["liverpool", "#c8102e"],
    ["chelsea", "#034694"],
    ["tottenham", "#132257"],
    ["brighton", "#0057b8"],
    ["arsenal", "#ef0107"],
    ["barcelona", "#a50044"],
    ["real madrid", "#febd11"],
    ["bayern", "#dc052d"],
    ["juventus", "#111111"],
    ["milan", "#fb090b"],
    ["inter", "#0068a8"],
    ["galatasaray", "#fdb912"],
    ["fenerbahce", "#f7d417"],
    ["besiktas", "#111111"],
    ["trabzonspor", "#7b1024"]
  ];
  const match = knownAccents.find(([keyword]) => normalized.includes(keyword));
  if (match) return match[1];

  const palette = ["#2563eb", "#dc2626", "#f59e0b", "#059669", "#7c3aed", "#0891b2", "#e11d48", "#65a30d", "#9333ea", "#0f766e"];
  return palette[hashString(normalized) % palette.length];
}

function normalizeTeamName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function eventSide(event: MatchDetailEvent, match: NormalizedMatch) {
  if (event.team.id === match.homeTeam.id) return "home";
  if (event.team.id === match.awayTeam.id) return "away";

  const eventTeamName = normalizeStatisticLookup(event.team.name);
  if (eventTeamName && eventTeamName === normalizeStatisticLookup(match.homeTeam.name)) return "home";
  if (eventTeamName && eventTeamName === normalizeStatisticLookup(match.awayTeam.name)) return "away";

  return "neutral";
}

function eventIcon(type: string) {
  const normalized = normalizeStatisticLookup(type);
  if (normalized.includes("corner") || normalized.includes("korner") || normalized.includes("kose")) return <Flag size={14} />;
  if (normalized.includes("var") || normalized.includes("video assistant")) return <Sparkles size={14} />;
  if (normalized.includes("substitut") || normalized.includes("oyuncu") || normalized.includes("degis")) return <RefreshCw size={14} />;
  if (normalized.includes("goal") || normalized.includes("gol") || normalized.includes("penalty") || normalized.includes("penalti")) return <Target size={14} />;
  if (normalized.includes("card") || normalized.includes("kart")) return <Shield size={14} />;
  return <Activity size={14} />;
}

function eventClass(type: string) {
  const normalized = normalizeStatisticLookup(type);
  if (normalized.includes("red") || normalized.includes("kirmizi")) return "red";
  if (normalized.includes("yellow") || normalized.includes("sari")) return "yellow";
  if (normalized.includes("goal") || normalized.includes("gol") || normalized.includes("penalty") || normalized.includes("penalti")) return "goal";
  if (normalized.includes("substitut") || normalized.includes("oyuncu") || normalized.includes("degis")) return "substitution";
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
