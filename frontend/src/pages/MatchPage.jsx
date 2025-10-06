import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import MatchCard from "../components/MatchCard";
import ChatRoomSticky from "../components/ChatRoomSticky";

import Tabs from "../components/Tabs";
import MatchSummary from "../components/MatchSummary";
import StatCompare from "../components/StatCompare";
import Lineups from "../components/Lineups";
import H2HList from "../components/H2HList";
import FormStrips from "../components/FormStrips";
import StandingsTable from "../components/StandingsTable";

const ALL_TABS = ["Özet", "İstatistik", "Sohbet", "Kadro", "H2H", "Form", "Puan"];

export default function MatchPage() {
  const { id } = useParams();
  const location = useLocation();
  const [tab, setTab] = useState(ALL_TABS[0]);
  const [data, setData] = useState({
    match: null,
    stats: [],
    h2h: [],
    form: { home: [], away: [] },
    standings: [],
  });
  const [lineups, setLineups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [highlighted, setHighlighted] = useState({});

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener?.("change", handler);
    mq.addListener?.(handler);
    return () => {
      mq.removeEventListener?.("change", handler);
      mq.removeListener?.(handler);
    };
  }, []);

  useEffect(() => {
    if (isDesktop && tab === "Sohbet") setTab("Özet");
  }, [isDesktop, tab]);

  const visibleTabs = isDesktop
    ? ["Özet", "İstatistik", "Kadro", "H2H", "Form", "Puan"]
    : ALL_TABS;

  // ----------------- Data fetch -----------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setApiError(null);

        const resMatch = await fetch(`/api/fixtures?fixture=${id}`);
        const matchJson = await resMatch.json().catch(() => ({}));

        let match = null;
        if (Array.isArray(matchJson?.fixtures)) match = matchJson.fixtures[0] || null;
        else if (matchJson?.fixtures) match = matchJson.fixtures;

        if (!match) {
          if (!cancelled) {
            setData((d) => ({ ...d, match: null }));
            setApiError("Maç bulunamadı.");
            setLoading(false);
          }
          return;
        }

        const homeId = match?.teams?.home?.id;
        const awayId = match?.teams?.away?.id;
        const leagueId = match?.league?.id;
        let season = match?.league?.season || new Date().getFullYear();

        const settled = await Promise.allSettled([
          fetch(`/api/statistics?fixture=${id}`),
          fetch(`/api/h2h?h2h=${homeId}-${awayId}`),
          fetch(`/api/form?team=${homeId}&last=5`),
          fetch(`/api/form?team=${awayId}&last=5`),
          leagueId && season
            ? fetch(`/api/standings?league=${leagueId}&season=${season}`)
            : Promise.resolve({ ok: false }),
        ]);

        const safeJson = async (res) => {
          try { if (!res || !res.ok) return {}; return await res.json(); }
          catch { return {}; }
        };

        const [statsJson, h2hJson, formHomeJson, formAwayJson, standingsJson] =
          await Promise.all(
            settled.map(async (s) => (s.status === "fulfilled" ? safeJson(s.value) : {}))
          );

        const stats = Array.isArray(statsJson?.response) ? statsJson.response
          : [statsJson?.response].filter(Boolean);
        const h2h = Array.isArray(h2hJson?.response) ? h2hJson.response
          : [h2hJson?.response].filter(Boolean);
        const formHomeArr = Array.isArray(formHomeJson?.response) ? formHomeJson.response
          : [formHomeJson?.response].filter(Boolean);
        const formAwayArr = Array.isArray(formAwayJson?.response) ? formAwayJson.response
          : [formAwayJson?.response].filter(Boolean);

        let standingsRows = [];
        const stResp = standingsJson?.response;
        if (Array.isArray(stResp) && stResp.length > 0) {
          const leagueObj = stResp[0]?.league || stResp.league;
          if (leagueObj?.standings) {
            const s = leagueObj.standings;
            standingsRows = Array.isArray(s[0]) ? s[0] : s.flat();
          }
        } else if (stResp?.league?.standings) {
          const s = stResp.league.standings;
          standingsRows = Array.isArray(s[0]) ? s[0] : s.flat();
        }

        if (!cancelled) {
          setData({
            match,
            stats,
            h2h,
            form: { home: formHomeArr, away: formAwayArr },
            standings: Array.isArray(standingsRows) ? standingsRows : [],
          });
          setLineups(match.lineups || []);
        }
      } catch (e) {
        console.error("fetch error", e);
        if (!cancelled) setApiError("Veri alınırken hata oluştu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const { match, stats, h2h, form, standings } = data;
  const homeId = match?.teams?.home?.id;
  const awayId = match?.teams?.away?.id;

  useEffect(() => {
    if (!match?.events) return;
    match.events.forEach((ev, idx) => {
      const key = `${ev.type}-${idx}`;
      if ((ev.type === "Goal" || ev.type === "Penalty") && !highlighted[key]) {
        setHighlighted((prev) => ({ ...prev, [key]: true }));
        setTimeout(() => {
          setHighlighted((prev) => ({ ...prev, [key]: false }));
        }, 15000);
      }
    });
  }, [match]); // eslint-disable-line

  const cardWrapRef = useRef(null);
  const [cardH, setCardH] = useState(0);
  useEffect(() => {
    const el = cardWrapRef.current;
    if (!el) return;
    const measure = () => setCardH(el.getBoundingClientRect().height || 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [match]);

  const scrollMaxH = "calc(100svh - var(--mbb, 0px) - 8px)";
  const contentPadBottom = "calc(var(--mbb, 0px) + 8px)";
  const tabsTop = `${Math.max(0, cardH + 8)}px`; 

  const from = location.state?.from || "/";

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Sol blok */}
      <div className="relative">
        <div
          className="overflow-y-auto overscroll-contain rounded-2xl"
          style={{ maxHeight: scrollMaxH }}
        >
          {/* MatchCard – sticky */}
          <div
            ref={cardWrapRef}
            className="sticky top-0 z-20 bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur pt-1 pb-2"
          >
            <MatchCard match={match} from={from} />
          </div>

          {/* Tabs */}
          <div
            className="sticky z-20 bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur px-3 sm:px-4 pb-2"
            style={{ top: tabsTop }}
          >
            <Tabs tabs={visibleTabs} active={tab} onChange={setTab} />
          </div>

          {/* İçerik */}
          <div
            className="px-3 sm:px-4 pt-2"
            style={{ paddingBottom: contentPadBottom }}
          >
            {tab === "Özet" && !loading && !apiError && match && (
              <MatchSummary match={match} homeId={homeId} highlighted={highlighted} />
            )}
            {tab === "İstatistik" && !loading && !apiError && (
              <StatCompare
                stats={stats}
                homeTeam={match?.teams?.home}
                awayTeam={match?.teams?.away}
              />
            )}
            {!isDesktop && tab === "Sohbet" && !loading && !apiError && (
              <ChatRoomSticky
                room={`match:${id}`}
                matchTitle={`${match?.teams?.home?.name || ""} - ${match?.teams?.away?.name || ""}`}
              />
            )}
            {tab === "Kadro" && !loading && !apiError && <Lineups lineups={lineups} />}
            {tab === "H2H" && !loading && !apiError && (
              <H2HList items={h2h} homeId={homeId} awayId={awayId} />
            )}
            {tab === "Form" && !loading && !apiError && (
              <FormStrips
                homeFixtures={form.home}
                awayFixtures={form.away}
                homeTeamId={homeId}
                awayTeamId={awayId}
                homeTeam={match?.teams?.home}
                awayTeam={match?.teams?.away}
              />
            )}
            {tab === "Puan" && !loading && !apiError && (
              Array.isArray(standings) && standings.length > 0 ? (
                <StandingsTable standings={standings} highlightIds={[homeId, awayId]} />
              ) : (
                <div>Puan durumu bulunamadı.</div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Sağ blok */}
      <div className="hidden lg:flex flex-col min-h-0 h-[calc(100svh-100px)]">
        <ChatRoomSticky
          room={`match:${id}`}
          matchTitle={
            data.match
              ? `${data.match?.teams?.home?.name || ""} - ${data.match?.teams?.away?.name || ""}`
              : ""
          }
          className="flex-1"
        />
      </div>
    </div>
  );
}
