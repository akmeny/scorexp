import React, { useEffect, useMemo, useRef, useState } from "react";
import MatchRow from "./MatchRow";

export default function LeagueGroup({ league, matches, favs, setFavs }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const onToggleAll = (e) => {
      const wantOpen = !!e.detail;
      setOpen(wantOpen);
    };
    window.addEventListener("scorexp:toggleAllLeagues", onToggleAll);
    return () => window.removeEventListener("scorexp:toggleAllLeagues", onToggleAll);
  }, []);

  const contentRef = useRef(null);
  const [maxH, setMaxH] = useState(0);

  const recalc = () => {
    const el = contentRef.current;
    if (!el) return;
    setMaxH(open ? el.scrollHeight : 0);
  };

  useEffect(() => {
    recalc();
    const r = () => recalc();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [open, matches]);

  const headerClasses = useMemo(
    () =>
      "flex items-center justify-between px-4 py-2 cursor-pointer " +
      "bg-gray-50/80 dark:bg-gray-700/70 " +
      "hover:bg-gray-100/80 dark:hover:bg-gray-700 transition",
    []
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden">
      {/* Lig başlık kutusu */}
      <div className={headerClasses} onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          {league?.flag && (
            <img src={league.flag} alt="" className="w-5 h-5 rounded-sm" />
          )}
          <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 opacity-80 leading-tight">
            {league?.country ? `${league.country} - ` : ""}
            {league?.name}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button title="Pinle" className="opacity-60 hover:opacity-100 transition">
            📌
          </button>
          <button
            aria-label={open ? "Kapat" : "Aç"}
            className="opacity-70 hover:opacity-100 transition"
          >
            {open ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Maç listesi */}
      <div
        ref={contentRef}
        style={{
          maxHeight: maxH,
          overflow: "hidden",
          transition: "max-height 320ms ease, opacity 240ms ease, transform 240ms ease",
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0)" : "translateY(-6px)",
        }}
      >
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {matches.map((m) => (
            <MatchRow key={m.fixture?.id} m={m} favs={favs} setFavs={setFavs} />
          ))}
        </div>
      </div>
    </div>
  );
}