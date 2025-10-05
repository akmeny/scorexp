import React from "react";
import { useNavigate } from "react-router-dom";

export default function MatchCard({ match }) {
  const navigate = useNavigate();
  if (!match) return null;

  const home = match.teams?.home;
  const away = match.teams?.away;
  const goals = match.goals || {};
  const fixture = match.fixture || {};
  const league = match.league || {};

  // Durum label (FT, NS, 1H, 2H vs)
  const status = fixture?.status?.short || "";
  const statusLong = fixture?.status?.long || "";

  const statusColor =
    status === "FT"
      ? "bg-gray-500"
      : status === "1H" || status === "2H" || status === "LIVE"
      ? "bg-red-600 animate-pulse"
      : status === "NS"
      ? "bg-blue-600"
      : "bg-gray-400";

  // Güvenli görüntü bileşeni
  const SafeImg = ({ src, alt, className }) => (
    <img
      src={src || ""}
      alt={alt || ""}
      className={className}
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
        e.currentTarget.style.width = "0px";
      }}
      loading="lazy"
      decoding="async"
    />
  );

  return (
    <div
      className="
        sticky top-0 z-10
        p-4 rounded-2xl
        bg-white/70 dark:bg-gray-900/60
        backdrop-blur-md shadow-md
        border border-gray-200 dark:border-gray-700
      "
    >
      {/* Üst şerit: Geri butonu + Lig + Ülke bayrağı + tarih */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Geri butonu */}
          <button
            onClick={() => navigate(-1)}
            className="px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            title="Geri"
          >
            ←
          </button>

          {/* Lig logosu */}
          <SafeImg
            src={league.logo}
            alt={league.name}
            className="w-5 h-5 rounded-sm"
          />
          {/* Ülke bayrağı */}
          <SafeImg
            src={league.flag}
            alt={league.country}
            className="w-5 h-5 rounded-sm"
          />
          <span className="truncate">
            {league.name}
            {league.season ? ` · ${league.season}` : ""}
          </span>
        </div>
        <span className="shrink-0">
          {fixture?.date
            ? new Date(fixture.date).toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : ""}
        </span>
      </div>

      {/* Takımlar ve skor */}
      <div className="flex items-center justify-between gap-2">
        {/* Home */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SafeImg src={home?.logo} alt={home?.name} className="w-10 h-10" />
          <span className="text-base font-semibold truncate">
            {home?.name}
          </span>
        </div>

        {/* Skor + durum */}
        <div className="flex flex-col items-center justify-center px-2 flex-none w-[80px]">
          <div className="text-2xl font-bold tabular-nums">
            {goals.home ?? 0} : {goals.away ?? 0}
          </div>
          <span
            className={`text-[11px] px-2 py-[2px] rounded-full text-white ${statusColor}`}
            title={statusLong}
          >
            {status || "—"}
          </span>
        </div>

        {/* Away */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-base font-semibold truncate text-right">
            {away?.name}
          </span>
          <SafeImg src={away?.logo} alt={away?.name} className="w-10 h-10" />
        </div>
      </div>

      {/* Alt bilgi satırı (ince gris yazı) */}
      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
        <span className="truncate">
          {fixture?.venue?.name || ""}{" "}
          {fixture?.venue?.city ? `· ${fixture.venue.city}` : ""}
        </span>
        <span className="truncate">
          {fixture?.referee ? `Ref: ${fixture.referee}` : ""}
        </span>
      </div>
    </div>
  );
}