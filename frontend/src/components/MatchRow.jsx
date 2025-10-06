import React, { useMemo, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const DANGER_MS = 15000;
const VAR_MS = 15000;
const PEN_MS = 15000;
const STRIP_MS = 15000;
const CANCEL_MS = 10000; // Gol İptal süresi

export default function MatchRow({
  m,
  favs = [],
  setFavs = () => {},
  browseState = {},
}) {
  const location = useLocation();

  const matchId = m?.fixture?.id;
  const statusShort = m?.fixture?.status?.short;
  const initialElapsed = m?.fixture?.status?.elapsed;
  const startTime = (m?.fixture?.date || "").slice(11, 16);
  const home = m?.teams?.home || {};
  const away = m?.teams?.away || {};
  const apiScore = {
    home: Number(m?.goals?.home ?? 0),
    away: Number(m?.goals?.away ?? 0),
  };

  // ————— Zaman & canlılık —————
  const [elapsed, setElapsed] = useState(initialElapsed);
  const isHT = statusShort === "HT";
  const isFT = ["FT", "AET", "PEN"].includes(statusShort || "");
  const isLive = !isHT && !isFT && typeof elapsed === "number" && statusShort !== "NS";

  useEffect(() => {
    setElapsed(initialElapsed);
    if (isLive) {
      const t = setInterval(() => {
        setElapsed((p) => (typeof p === "number" ? p + 1 : p));
      }, 60000);
      return () => clearInterval(t);
    }
  }, [isLive, initialElapsed]);

  // Dakika formatlama: 1→45, 45+X, 46→90, 90+X
  const statusText = useMemo(() => {
    if (statusShort === "NS") return startTime || "-";
    if (isFT) return "FT";
    if (isHT) return "HT";

    const e = Math.max(1, Number(elapsed || 0));

    if (statusShort === "1H" || (!statusShort && e <= 45)) {
      if (e <= 45) return `${e}'`;
      return `45+${e - 45}'`;
    }
    if (statusShort === "2H" || (!statusShort && e > 45)) {
      if (e <= 90) return `${Math.max(46, e)}'`;
      return `90+${e - 90}'`;
    }
    if (e <= 45) return `${e}'`;
    if (e <= 90) return `${e}'`;
    return `90+${e - 90}'`;
  }, [statusShort, isHT, isFT, elapsed, startTime]);

  // ————— Görsel efekt state’leri —————
  const [displayScore, setDisplayScore] = useState(apiScore);
  const lastApiScoreRef = useRef(apiScore);
  const pendingScoreRef = useRef(null);
  const [goalStripUntil, setGoalStripUntil] = useState(0);
  const [stripKey, setStripKey] = useState(0);
  const [bumpSide, setBumpSide] = useState(null);

  const [danger, setDanger] = useState({ side: null, until: 0 });
  const [varFx, setVarFx] = useState({ side: null, until: 0 });
  const [penFx, setPenFx] = useState({ side: null, until: 0, missed: false });
  const [cancelFx, setCancelFx] = useState({ side: null, until: 0 });
  const [reds, setReds] = useState({ home: 0, away: 0 });

  // ————— Event yardımcıları —————
  const homeId = home?.id;
  const awayId = away?.id;
  const sideOfTeam = (teamId) => (teamId === homeId ? "home" : teamId === awayId ? "away" : null);
  const now = () => Date.now();

  const events = Array.isArray(m?.events) ? m.events : [];

  // Kırmızı kart sayaçları
  useEffect(() => {
    if (!events.length) return;
    const r = { home: 0, away: 0 };
    for (const ev of events) {
      if (ev?.type === "Card" && (ev?.detail === "Red Card" || ev?.detail === "Second Yellow card")) {
        const side = sideOfTeam(ev?.team?.id);
        if (side) r[side] += 1;
      }
    }
    setReds(r);
  }, [events, homeId, awayId]);

  // VAR / Penaltı / Gol İptal (event bazlı)
  useEffect(() => {
    if (!events.length) return;
    const latest = events[events.length - 1];
    const detail = String(latest?.detail || "");
    const type = String(latest?.type || "").toLowerCase();
    const side = sideOfTeam(latest?.team?.id) || null;

    if (type === "var") {
      setVarFx({ side: side || "both", until: now() + VAR_MS });
      if (/penalty/i.test(detail)) {
        setPenFx({ side: side || "home", until: now() + PEN_MS, missed: false });
      }
      if (/cancel|disallow|iptal/i.test(detail)) {
        setCancelFx({ side: side || null, until: now() + CANCEL_MS });
      }
    }
    if (type === "penalty") {
      setPenFx({ side, until: now() + PEN_MS, missed: false });
    }
    if (type === "goal" && /missed/i.test(detail)) {
      setPenFx({ side, until: now() + PEN_MS, missed: true });
    }
  }, [events]); // eslint-disable-line

  // ————— Skor akışı: artış / iptal —————
  useEffect(() => {
    const prev = lastApiScoreRef.current;
    const curr = apiScore;

    const incHome = curr.home > prev.home;
    const incAway = curr.away > prev.away;
    const decHome = curr.home < prev.home;
    const decAway = curr.away < prev.away;

    if ((decHome || decAway) && !isFT) {
      const side = decHome ? "home" : "away";
      setCancelFx({ side, until: now() + CANCEL_MS });

      pendingScoreRef.current = null;
      setDanger({ side: null, until: 0 });
      setGoalStripUntil(0);
      setBumpSide(null);

      setDisplayScore(curr);
      lastApiScoreRef.current = curr;
      return;
    }

    if ((incHome || incAway) && isLive) {
      const side = incHome ? "home" : "away";
      setDanger({ side, until: now() + DANGER_MS });
      pendingScoreRef.current = curr;

      const t = setTimeout(() => {
        const next = pendingScoreRef.current || curr;

        setDisplayScore(next);

        const stamp = Date.now();
        setStripKey(stamp);
        setGoalStripUntil(stamp + STRIP_MS);

        setBumpSide(side);
        setTimeout(() => setBumpSide(null), 900);

        pendingScoreRef.current = null;
      }, DANGER_MS);

      lastApiScoreRef.current = curr;
      return () => clearTimeout(t);
    }

    lastApiScoreRef.current = curr;
  }, [apiScore.home, apiScore.away, isLive, isFT]); // eslint-disable-line

  // İlk mount
  useEffect(() => {
    setDisplayScore(apiScore);
    lastApiScoreRef.current = apiScore;
  }, []); // eslint-disable-line

  // ————— UI hesaplamaları —————
  const gH = statusShort === "NS" ? null : displayScore.home;
  const gA = statusShort === "NS" ? null : displayScore.away;

  const showStrip = Date.now() < goalStripUntil;
  const showDangerHome = danger.side === "home" && Date.now() < danger.until && !isFT;
  const showDangerAway = danger.side === "away" && Date.now() < danger.until && !isFT;

  const showVarHome = varFx.side === "home" && Date.now() < varFx.until && !isFT;
  const showVarAway = varFx.side === "away" && Date.now() < varFx.until && !isFT;
  const showVarBoth = varFx.side === "both" && Date.now() < varFx.until && !isFT;

  const showPenHome = penFx.side === "home" && Date.now() < penFx.until && !isFT;
  const showPenAway = penFx.side === "away" && Date.now() < penFx.until && !isFT;

  const showCancelHome = cancelFx.side === "home" && Date.now() < cancelFx.until;
  const showCancelAway = cancelFx.side === "away" && Date.now() < cancelFx.until;

  // Canlı bitene dek skor kırmızı
  const liveRed = isLive || isHT;
  const scoreClsHome = `${liveRed ? "text-red-600" : ""} ${
    bumpSide === "home" ? "font-extrabold animate-score" : "font-semibold"
  }`;
  const scoreClsAway = `${liveRed ? "text-red-600" : ""} ${
    bumpSide === "away" ? "font-extrabold animate-score" : "font-semibold"
  }`;

  // Favori toggle
  const toggleFav = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!matchId) return;
    const next = favs.includes(matchId) ? favs.filter((x) => x !== matchId) : [...favs, matchId];
    setFavs(next);
    try {
      localStorage.setItem("scorexp-favs", JSON.stringify(next));
    } catch {}
  };

  return (
    <Link
      to={`/match/${matchId}`}
      state={{ from: location.pathname + location.search, backState: browseState }}
      className="relative flex items-stretch gap-[6px] px-3 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition match-row rounded-lg"
    >
      {/* Efekt stilleri */}
      <style>{`
        @keyframes stripGrow {
          0%   { transform: scaleX(0); opacity: .48; }
          30%  { opacity: .40; }
          100% { transform: scaleX(1); opacity: .20; }
        }
        .goal-strip {
          position: absolute; inset: 0; left: 0; top: 0;
          transform-origin: left center;
          background:
            radial-gradient(120% 120% at 0% 50%, rgba(220,38,38,.42), rgba(220,38,38,0) 60%),
            linear-gradient(90deg, rgba(220,38,38,.38), rgba(220,38,38,.20) 65%, rgba(255,255,255,0));
          pointer-events: none;
          z-index: 1;
          animation: stripGrow ${STRIP_MS/1000}s ease-in-out forwards;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: inset 0 0 30px rgba(220,38,38,.40);
        }
        .dark .goal-strip {
          background:
            radial-gradient(120% 120% at 0% 50%, rgba(255,59,48,.85), rgba(255,59,48,0) 62%),
            linear-gradient(90deg, rgba(255,59,48,.78), rgba(255,59,48,.40) 70%, rgba(255,255,255,0));
          box-shadow:
            inset 0 0 42px rgba(255,59,48,.75),
            0 0 16px rgba(255,59,48,.42);
          filter: saturate(1.2) contrast(1.1);
        }
        @keyframes sparkMove {
          0%   { transform: translateX(-40%); opacity: .0; }
          10%  { opacity: .60; }
          50%  { opacity: .32; }
          100% { transform: translateX(140%); opacity: 0; }
        }
        .goal-strip .goal-spark {
          position: absolute; top: 0; bottom: 0; width: 26%;
          background: radial-gradient(120px 100% at 30% 50%, rgba(255,255,255,.78), rgba(255,255,255,.0) 70%);
          filter: blur(1.2px);
          animation: sparkMove 1.4s ease-out 0s 2;
        }
        .dark .goal-strip .goal-spark {
          background: radial-gradient(120px 100% at 30% 50%, rgba(255,255,255,.95), rgba(255,255,255,0) 72%);
          filter: blur(1px);
        }
        @keyframes blinkDanger {
          0%, 100% { background:#dc2626; color:#fff; }
          50%      { background:#fff; color:#dc2626; }
        }
        .danger-badge {
          font-size: 10px; line-height: 1; padding: 2px 6px; border-radius: 9999px;
          animation: blinkDanger .8s linear infinite;
          border: 1px solid rgba(220,38,38,.5);
        }
        @keyframes blinkVar {
          0%, 100% { background:#facc15; color:#fff; }
          50%      { background:#fff; color:#facc15; border-color:#facc15; }
        }
        .var-badge {
          font-size: 10px; line-height: 1; padding: 2px 6px; border-radius: 6px;
          animation: blinkVar .8s linear infinite;
          border: 1px solid #facc15;
        }
        .pen-badge {
          font-size: 10px; line-height: 1; padding: 2px 6px; border-radius: 6px;
          background:#111; color:#fff;
        }
        .pen-badge.red { background:#dc2626; color:#fff; }
        .cancel-badge {
          font-size: 10px; line-height: 1; padding: 2px 6px; border-radius: 9999px;
          background:#fff; color:#dc2626; border:1px solid rgba(220,38,38,.65);
        }
        .dark .cancel-badge {
          background:#0b0b0b; color:#fecaca; border-color: rgba(248,113,113,.75);
        }
        @keyframes scorePop { 0%{transform:scale(1);}35%{transform:scale(1.28);}100%{transform:scale(1);} }
        .animate-score { animation: scorePop .9s ease; }
        .mini-red {
          display:inline-flex; align-items:center; justify-content:center;
          min-width:16px; height:16px; font-size:10px; border-radius:9999px;
          color:#fff; background:#dc2626; padding:0 4px; margin-left:4px;
        }
        /* ✔ Skor kutusu: sabit genişlik + ortalı + tabular numerik + küçük font */
        .score-box {
          min-width: 28px;
          text-align: center;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "lnum" 1;
          font-size: 0.75rem; /* text-xs */
          line-height: 1rem;
        }
      `}</style>

      {showStrip && (
        <div key={stripKey} className="goal-strip">
          <div className="goal-spark" />
        </div>
      )}

      {/* Durum — font boyutu takım isimleriyle aynı */}
      <div className="w-9 flex items-center justify-center text-xs">
        <span className={isLive || isHT ? "text-red-600 font-bold" : "opacity-80"}>
          {statusText}
        </span>
      </div>

      <div className="w-px bg-gray-200 dark:bg-gray-600" />

      {/* Takımlar ve skor — satır yüksekliği kompakt */}
      <div className="flex-1 min-w-0 flex flex-col gap-[2px] py-[2px]">
        {/* Home */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {home.logo && <img src={home.logo} alt={home.name} className="w-[14px] h-[14px] rounded-full" />}
            <span className="text-xs truncate">{home.name}</span>
            {reds.home > 0 && <span className="mini-red">{reds.home}</span>}
            {showDangerHome && <span className="danger-badge">TEHLİKE</span>}
            {showPenHome && (
              <span className={`pen-badge ${penFx.missed ? "" : "red"}`}>
                {penFx.missed ? "PENALTI KAÇTI" : "PENALTI"}
              </span>
            )}
            {showVarHome && <span className="var-badge">VAR</span>}
            {showVarBoth && <span className="var-badge">VAR</span>}
            {showCancelHome && <span className="cancel-badge">GOL İPTAL</span>}
          </div>
          <span className={`${scoreClsHome} score-box pr-2`}>
            {gH === null ? "–" : gH}
          </span>
        </div>

        {/* Away */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {away.logo && <img src={away.logo} alt={away.name} className="w-[14px] h-[14px] rounded-full" />}
            <span className="text-xs truncate">{away.name}</span>
            {reds.away > 0 && <span className="mini-red">{reds.away}</span>}
            {showDangerAway && <span className="danger-badge">TEHLİKE</span>}
            {showPenAway && (
              <span className={`pen-badge ${penFx.missed ? "" : "red"}`}>
                {penFx.missed ? "PENALTI KAÇTI" : "PENALTI"}
              </span>
            )}
            {showVarAway && <span className="var-badge">VAR</span>}
            {showVarBoth && <span className="var-badge">VAR</span>}
            {showCancelAway && <span className="cancel-badge">GOL İPTAL</span>}
          </div>
          <span className={`${scoreClsAway} score-box pr-2`}>
            {gA === null ? "–" : gA}
          </span>
        </div>
      </div>

      <div className="w-px bg-gray-200 dark:bg-gray-600" />

      {/* Favori */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!matchId) return;
          const next = favs.includes(matchId) ? favs.filter((x) => x !== matchId) : [...favs, matchId];
          setFavs(next);
          try { localStorage.setItem("scorexp-favs", JSON.stringify(next)); } catch {}
        }}
        title="Favorilere ekle"
        className={`w-6 text-lg ${favs.includes(matchId) ? "text-yellow-400" : "text-gray-400"} hover:scale-110 transition`}
      >
        ★
      </button>
    </Link>
  );
}