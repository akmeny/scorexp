import React, { useEffect, useMemo, useRef, useState } from "react";
import MatchRow from "./MatchRow";

export default function LeagueGroup({
  league,
  matches,
  favs,
  setFavs,
  isPinned = () => false,
  togglePin = () => {},
  // DnD (sadece kullanıcı eklediği pinler için etkin)
  canDrag = false,
  onDragStartLg,
  onDragOverLg,
  onDropLg,
}) {
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

  const pinned = isPinned(league?.id);

  // Header stilleri: daha küçük & soluk yazı, açık modda daha gri zemin
  const headerBase =
    "flex items-center justify-between px-4 py-1.5 select-none " +
    (canDrag ? "cursor-grab active:cursor-grabbing " : "cursor-pointer ") +
    "bg-gray-100/90 dark:bg-gray-700/70 " +
    "hover:bg-gray-200/90 dark:hover:bg-gray-700 transition";

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden"
      data-leagueid={league?.id}
    >
      {/* Başlık */}
      <div
        className={headerBase}
        onClick={() => setOpen((v) => !v)}
        draggable={canDrag}
        onDragStart={(e) => {
          if (!canDrag) return;
          e.stopPropagation();
          onDragStartLg?.(e);
        }}
        onDragOver={(e) => {
          if (!canDrag) return;
          onDragOverLg?.(e);
        }}
        onDrop={(e) => {
          if (!canDrag) return;
          onDropLg?.(e);
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {league?.flag && <img src={league.flag} alt="" className="w-4 h-4 rounded-sm" />}
          <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-tight truncate">
            {league?.country ? `${league.country} - ` : ""}
            {league?.name}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 📌 Pin butonu */}
          <button
            title={pinned ? "Sabitlerden çıkar" : "Sabitle"}
            onClick={(e) => {
              e.stopPropagation();
              if (league?.id) togglePin(league.id);
            }}
            className={
              "transition " +
              (pinned
                ? "opacity-100 text-yellow-500 hover:scale-110"
                : "opacity-60 hover:opacity-100 hover:scale-110 text-gray-500 dark:text-gray-300")
            }
          >
            {pinned ? "📌" : "📍"}
          </button>

          {/* Aç/Kapa oku */}
          <button
            aria-label={open ? "Kapat" : "Aç"}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="opacity-80 hover:opacity-100 transition"
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