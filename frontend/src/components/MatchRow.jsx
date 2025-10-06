import React, { useMemo, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";

export default function MatchRow({ m, favs = [], setFavs = () => {} }) {
  const statusShort = m?.fixture?.status?.short;
  const initialElapsed = m?.fixture?.status?.elapsed;
  const startTime = (m?.fixture?.date || "").slice(11, 16);
  const matchId = m?.fixture?.id;

  const [elapsed, setElapsed] = useState(initialElapsed);
  const [lastScore, setLastScore] = useState({
    home: m?.goals?.home ?? 0,
    away: m?.goals?.away ?? 0
  });
  const [goalFlashUntil, setGoalFlashUntil] = useState(0);

  // Dakika sayaç fix
  useEffect(() => {
    setElapsed(initialElapsed);
    if (["1H", "2H", "ET", "LIVE"].includes(statusShort)) {
      const timer = setInterval(() => {
        setElapsed((prev) => (typeof prev === "number" ? prev + 1 : prev));
      }, 60000);
      return () => clearInterval(timer);
    }
  }, [statusShort, initialElapsed]);

  const home = m?.teams?.home || {};
  const away = m?.teams?.away || {};
  const gH = statusShort === "NS" ? null : Number(m?.goals?.home ?? 0);
  const gA = statusShort === "NS" ? null : Number(m?.goals?.away ?? 0);

  // Goal flash fallback: skor değiştiyse 15s efekt göster
  useEffect(() => {
    if (gH !== null && gA !== null) {
      if (gH !== lastScore.home || gA !== lastScore.away) {
        setGoalFlashUntil(Date.now() + 15000);
        setLastScore({ home: gH, away: gA });
      }
    }
  }, [gH, gA]);

  const effects = m?._effects || {};
  const reds = effects?.reds || { home: 0, away: 0 };
  const danger = effects?.danger || { side: null, until: 0 };
  const penalty = effects?.penalty || { side: null, until: 0, missed: false };
  const varfx = effects?.var || { side: null, until: 0 };

  const isHT = statusShort === "HT";
  const isFT = ["FT", "AET", "PEN"].includes(statusShort || "");
  const isLive = !isHT && !isFT && typeof elapsed === "number";

  const statusText = useMemo(() => {
    if (statusShort === "NS") return startTime || "-";
    if (isHT) return "HT";
    if (isFT) return "FT";
    if (typeof elapsed === "number") return `${elapsed}'`;
    return statusShort || "-";
  }, [statusShort, isHT, isFT, elapsed, startTime]);

  const scoreCls = isLive || isHT ? "text-red-500 font-semibold" : "font-semibold";

  const toggleFav = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!matchId) return;
    const next = favs.includes(matchId) ? favs.filter((x) => x !== matchId) : [...favs, matchId];
    setFavs(next);
    try { localStorage.setItem("scorexp-favs", JSON.stringify(next)); } catch {}
  };

  const showStrip = Date.now() < (effects?.goalFlashUntil || goalFlashUntil);
  const showVarHome = varfx?.side === "home" && Date.now() < varfx?.until;
  const showVarAway = varfx?.side === "away" && Date.now() < varfx?.until;
  const showVarBoth = varfx?.side === "both" && Date.now() < varfx?.until;
  const showDangerHome = danger?.side === "home" && Date.now() < danger?.until;
  const showDangerAway = danger?.side === "away" && Date.now() < danger?.until;
  const showPenHome = penalty?.side === "home" && Date.now() < penalty?.until;
  const showPenAway = penalty?.side === "away" && Date.now() < penalty?.until;

  return (
    <Link
      to={`/match/${matchId}`}
      className="relative flex items-stretch gap-1 px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition match-row rounded-lg"
    >
      <style>{`
        @keyframes strip { 
          0%{transform:translateX(-100%);opacity:.22} 
          100%{transform:translateX(0);opacity:0} 
        }
        .goal-strip { position:absolute; inset:0; background:linear-gradient(90deg, rgba(239,68,68,.12), rgba(239,68,68,.06), rgba(239,68,68,0)); pointer-events:none; animation: strip 10s linear 1; }
      `}</style>

      {showStrip && <div className="goal-strip" />}

      {/* Durum */}
      <div className="w-10 flex items-center justify-center text-[11px]">
        <span className={isLive || isHT ? "text-red-600 font-bold" : "opacity-80"}>
          {statusText}
        </span>
      </div>

      <div className="w-px bg-gray-200 dark:bg-gray-600" />

      {/* Takımlar */}
      <div className="flex-1 flex flex-col gap-[2px]">
        {/* Home */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {home.logo && <img src={home.logo} alt={home.name} className="w-4 h-4 rounded-full" />}
            <span className="text-sm truncate">{home.name}</span>
            {reds?.home > 0 && <span className="mini-red">{reds.home}</span>}
            {showDangerHome && <span className="danger-badge">TEHLİKE</span>}
            {showPenHome && (
              <span className="danger-badge" style={{ background: penalty?.missed ? "#111" : "#dc2626", color:"#fff" }}>
                {penalty?.missed ? "PENALTI KAÇTI" : "PENALTI"}
              </span>
            )}
            {showVarHome && <span className="var-badge">VAR</span>}
          </div>
          <span className={`${scoreCls} pr-2 min-w-[16px] text-right`}>{gH === null ? "–" : gH}</span>
        </div>

        {/* Away */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            {away.logo && <img src={away.logo} alt={away.name} className="w-4 h-4 rounded-full" />}
            <span className="text-sm truncate">{away.name}</span>
            {reds?.away > 0 && <span className="mini-red">{reds.away}</span>}
            {showDangerAway && <span className="danger-badge">TEHLİKE</span>}
            {showPenAway && (
              <span className="danger-badge" style={{ background: penalty?.missed ? "#111" : "#dc2626", color:"#fff" }}>
                {penalty?.missed ? "PENALTI KAÇTI" : "PENALTI"}
              </span>
            )}
            {showVarAway && <span className="var-badge">VAR</span>}
          </div>
          <span className={`${scoreCls} pr-2 min-w-[16px] text-right`}>{gA === null ? "–" : gA}</span>
        </div>
      </div>

      <div className="w-px bg-gray-200 dark:bg-gray-600" />

      {/* Favori */}
      <button
        onClick={toggleFav}
        title="Favorilere ekle"
        className={`w-6 text-lg ${favs.includes(matchId) ? "text-yellow-400" : "text-gray-400"} hover:scale-110 transition`}
      >
        ★
      </button>
    </Link>
  );
}