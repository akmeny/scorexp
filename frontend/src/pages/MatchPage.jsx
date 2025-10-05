import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import MatchCard from "../components/MatchCard";
import ChatRoomSticky from "../components/ChatRoomSticky";
import StatCompare from "../components/StatCompare";
import StandingsTable from "../components/StandingsTable";
import H2HList from "../components/H2HList";
import FormStrips from "../components/FormStrips";

const Tabs = ["Özet", "İstatistik", "Sohbet", "Kadro", "H2H", "Form", "Puan"];

export default function MatchPage() {
  const { id } = useParams();
  const [tab, setTab] = useState(Tabs[0]);
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

  const swipeRef = useRef(null);
  const startX = useRef(0);

  // Sekmeler arası swipe
  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
    const onTouchEnd = (e) => {
      const diff = e.changedTouches[0].clientX - startX.current;
      if (Math.abs(diff) > 50) {
        const idx = Tabs.indexOf(tab);
        if (diff < 0 && idx < Tabs.length - 1) setTab(Tabs[idx + 1]);
        else if (diff > 0 && idx > 0) setTab(Tabs[idx - 1]);
      }
    };
    el.addEventListener("touchstart", onTouchStart);
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [tab]);

  // Veri çekimleri
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setApiError(null);

        const resMatch = await fetch(`/api/fixtures?fixture=${id}`);
        const matchJson = await resMatch.json().catch(() => ({}));

        let match = null;
        if (Array.isArray(matchJson?.fixtures)) {
          match = matchJson.fixtures[0] || null;
        } else if (matchJson?.fixtures) {
          match = matchJson.fixtures;
        }

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

  // Highlight efektleri
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match]);

  return (
    <div className="page-90vh grid grid-cols-1 gap-4 mt-4">
      {/* Sol blok */}
      <div className="h-full overflow-y-auto">
        <MatchCard match={match} />

        <div className="mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
          {/* Sekmeler */}
          <div className="flex gap-2 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto whitespace-nowrap">
            {Tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  tab === t
                    ? "bg-blue-600 text-white shadow"
                    : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* İçerikler */}
          <div ref={swipeRef} className="p-3 sm:p-4 text-sm opacity-90 space-y-4">
            {loading && <div>Yükleniyor...</div>}
            {apiError && !loading && <div>{apiError}</div>}

            {/* ÖZET */}
            {!loading && !apiError && tab === "Özet" && match && (
              <div className="space-y-6">
                {Array.isArray(match.events) && match.events.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-base sm:text-lg mb-4">Maç Olayları</h3>
                    <div className="relative">
                      <div className="absolute left-1/2 transform -translate-x-1/2 h-full border-l-2 border-gray-300 dark:border-gray-600"></div>
                      <div className="space-y-6 sm:space-y-8">
                        {match.events.map((ev, idx) => {
                          const isHome = ev.team?.id === homeId;
                          const key = `${ev.type}-${idx}`;

                          let baseClasses =
                            "max-w-full sm:max-w-[70%] p-2 sm:p-3 rounded-lg shadow-md border text-xs sm:text-sm transition";
                          let label = "";

                          if (ev.type === "Goal") {
                            baseClasses += " bg-green-100 border-green-500 dark:bg-green-900";
                            label = "⚽ Gol";
                          } else if (ev.type === "Penalty") {
                            baseClasses += " bg-red-100 border-red-500 dark:bg-red-900";
                            label = "⚡ Penaltı";
                          } else if (ev.type === "Card" && ev.detail?.includes("Yellow")) {
                            baseClasses += " border-2 border-yellow-500 dark:bg-yellow-900/40";
                            label = "🟨 Sarı Kart";
                          } else if (ev.type === "Card" && ev.detail?.includes("Red")) {
                            baseClasses += " border-2 border-red-600 dark:bg-red-900/40";
                            label = "🟥 Kırmızı Kart";
                          } else if (ev.type === "subst") {
                            baseClasses += " bg-blue-50 border-blue-300 dark:bg-blue-900/40";
                            label = "🔄 Değişiklik";
                          } else if (ev.type === "VAR") {
                            baseClasses += " bg-gray-100 border border-gray-400 dark:bg-gray-700 animate-pulse";
                            label = "🕵️ VAR Kontrolü";
                          }

                          if (highlighted[key]) {
                            if (ev.type === "Goal") baseClasses += " goal-highlight";
                            if (ev.type === "Penalty") baseClasses += " penalty-highlight";
                          }

                          return (
                            <div
                              key={idx}
                              className={`relative flex items-start ${isHome ? "justify-start" : "justify-end"}`}
                            >
                              <div className={baseClasses}>
                                <div className="flex items-center gap-2 mb-1">
                                  <img src={ev.team?.logo} alt={ev.team?.name} className="w-5 h-5" />
                                  <span className="font-semibold">{ev.team?.name}</span>
                                </div>
                                <div className="mb-1"><span>{label}</span></div>
                                <div className="text-xs opacity-80">
                                  {ev.player?.name}
                                  {ev.assist?.name ? ` → ${ev.assist?.name}` : ""}
                                </div>
                                <div className="text-[11px] opacity-60 mt-1">
                                  {ev.time?.elapsed}' dk
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* İSTATİSTİK */}
            {!loading && !apiError && tab === "İstatistik" && (
              <StatCompare stats={stats} match={match} />
            )}

            {/* SOHBET */}
            {!loading && !apiError && tab === "Sohbet" && (
              <div className="h-[calc(100vh-220px)] flex flex-col">
                <ChatRoomSticky
                  room={`match:${id}`}
                  matchTitle={
                    match
                      ? `${match?.teams?.home?.name || ""} - ${match?.teams?.away?.name || ""}`
                      : ""
                  }
                />
              </div>
            )}

            {/* KADRO */}
            {!loading && !apiError && tab === "Kadro" && (
              <div className="space-y-6">
                {Array.isArray(lineups) && lineups.length > 0 ? (
                  lineups.map((team, idx) => (
                    <div key={idx} className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <img src={team.team?.logo} alt={team.team?.name} className="w-6 h-6" />
                        <h3 className="font-semibold">{team.team?.name}</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {team.startXI?.map((p, i) => (
                          <div
                            key={i}
                            className="text-sm bg-white dark:bg-gray-800 rounded px-2 py-1 flex items-center justify-between border"
                          >
                            <span>{p.player?.number}. {p.player?.name}</span>
                            <span className="opacity-60">{p.player?.pos || "-"}</span>
                          </div>
                        ))}
                      </div>

                      {Array.isArray(team.substitutes) && team.substitutes.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Yedekler</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {team.substitutes.map((p, i) => (
                              <div
                                key={i}
                                className="text-sm bg-gray-100 dark:bg-gray-600 rounded px-2 py-1 flex items-center justify-between"
                              >
                                <span>{p.player?.number}. {p.player?.name}</span>
                                <span className="opacity-60">{p.player?.pos || "-"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div>Kadro bilgisi bulunamadı.</div>
                )}
              </div>
            )}

            {/* H2H */}
            {!loading && !apiError && tab === "H2H" && (
              <H2HList items={h2h} homeId={homeId} awayId={awayId} />
            )}

            {/* FORM */}
            {!loading && !apiError && tab === "Form" && (
              <FormStrips
                homeFixtures={form.home}
                awayFixtures={form.away}
                homeTeamId={homeId}
                awayTeamId={awayId}
                homeTeam={match?.teams?.home}
                awayTeam={match?.teams?.away}
              />
            )}

            {/* PUAN */}
            {!loading && !apiError && tab === "Puan" && (
              Array.isArray(standings) && standings.length > 0 ? (
                <div className="overflow-x-auto">
                  <StandingsTable standings={standings} highlightIds={[homeId, awayId]} />
                </div>
              ) : (
                <div>Puan durumu bulunamadı.</div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}