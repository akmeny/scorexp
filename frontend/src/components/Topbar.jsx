import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Sun,
  Moon,
  User,
  ChevronLeft,
  ChevronRight,
  Star,
  Activity,
  ChevronUp,
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

const sports = ["⚽", "🏀", "🎾", "🏐"];

export default function Topbar() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [sportIdx, setSportIdx] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [activeFilter, setActiveFilter] = useState("today"); // "today" | "live" | "fav" | "date"
  const [allOpen, setAllOpen] = useState(true); // tüm ligleri aç/kapat state

  // Tarih değiştir (masaüstü)
  const shiftDay = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    const val = d.toISOString().split("T")[0];
    setDate(val);
    setActiveFilter("date");
    window.dispatchEvent(new CustomEvent("scorexp:setDate", { detail: val }));
    window.dispatchEvent(new CustomEvent("scorexp:setOnlyLive", { detail: false }));
    window.dispatchEvent(new CustomEvent("scorexp:setOnlyFav", { detail: false }));
  };

  const toToday = () => {
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
    setActiveFilter("today");
    window.dispatchEvent(new CustomEvent("scorexp:setDate", { detail: today }));
    window.dispatchEvent(new CustomEvent("scorexp:setOnlyLive", { detail: false }));
    window.dispatchEvent(new CustomEvent("scorexp:setOnlyFav", { detail: false }));
  };

  const setLive = () => {
    setActiveFilter("live");
    window.dispatchEvent(new CustomEvent("scorexp:setOnlyLive", { detail: true }));
    window.dispatchEvent(new CustomEvent("scorexp:setOnlyFav", { detail: false }));
  };

  const setFav = () => {
    setActiveFilter("fav");
    window.dispatchEvent(new CustomEvent("scorexp:setOnlyFav", { detail: true }));
    window.dispatchEvent(new CustomEvent("scorexp:setOnlyLive", { detail: false }));
  };

  // Tüm ligleri aç/kapat
  const toggleAllLeagues = () => {
    const next = !allOpen;
    setAllOpen(next);
    window.dispatchEvent(new CustomEvent("scorexp:toggleAllLeagues", { detail: next }));
  };

  return (
    <>
      {/* Masaüstü Topbar */}
      <div className="hidden sm:block sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="px-1 py-4 flex items-center gap-2">
          {/* Logo */}
          <Link
            to="/"
            className="text-3xl font-extrabold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-sm hover:drop-shadow-lg transition"
            onClick={() => setActiveFilter("today")}
          >
            Scorexp
          </Link>

          {/* Spor seçici */}
          <button
            className="btn-fancy"
            onClick={() => {
              const next = (sportIdx + 1) % sports.length;
              setSportIdx(next);
              window.dispatchEvent(new CustomEvent("scorexp:setSport", { detail: sports[next] }));
            }}
          >
            {sports[sportIdx]}
          </button>

          {/* Gün kontrolleri (masaüstü) */}
          <button onClick={() => shiftDay(-1)} className="btn-fancy">
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={toToday}
            className={`btn-fancy ${activeFilter === "today" ? "btn-blue" : ""}`}
          >
            Bugün
          </button>
          <button onClick={() => shiftDay(1)} className="btn-fancy">
            <ChevronRight size={16} />
          </button>

          {/* Tarih seçici */}
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setActiveFilter("date");
              window.dispatchEvent(new CustomEvent("scorexp:setDate", { detail: e.target.value }));
              window.dispatchEvent(new CustomEvent("scorexp:setOnlyLive", { detail: false }));
              window.dispatchEvent(new CustomEvent("scorexp:setOnlyFav", { detail: false }));
            }}
            className="btn-fancy text-sm"
          />

          {/* Canlı */}
          <button
            className={`btn-fancy ${activeFilter === "live" ? "btn-red" : ""}`}
            onClick={setLive}
          >
            <Activity size={16} /> Canlı
          </button>

          {/* Favoriler */}
          <button
            className={`btn-fancy ${activeFilter === "fav" ? "btn-yellow" : ""}`}
            onClick={setFav}
          >
            <Star size={16} /> Favoriler
          </button>

          {/* Tüm ligleri aç/kapat */}
          <button className="btn-fancy" onClick={toggleAllLeagues} title="Tüm Ligleri Aç/Kapat">
            {allOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          <div className="flex-1" />

          {/* Sağ ikonlar */}
          <button className="btn-fancy" title="Ara">
            <Search size={16} />
          </button>
          <button onClick={toggleTheme} className="btn-fancy" title="Tema">
            {isDark ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="btn-fancy" title="Profil">
            <User size={16} />
          </button>
        </div>
      </div>

      {/* Mobil Alt Bar — daima sabit oval kutu */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50
        mx-2 mb-2 rounded-2xl shadow-lg
        bg-white/90 dark:bg-gray-900/90 backdrop-blur
        border border-gray-200 dark:border-gray-800
        flex justify-around py-2 gap-2 px-2">
        
        <button
          onClick={toToday}
          className={`btn-fancy flex-1 text-sm ${activeFilter === "today" ? "btn-blue" : ""}`}
          title="Bugün"
        >
          <span className="flex items-center justify-center gap-1 w-full">
            <CalendarDays size={16} />
            <span>Bugün</span>
          </span>
        </button>

        <button
          onClick={setLive}
          className={`btn-fancy flex-1 text-sm ${activeFilter === "live" ? "btn-red" : ""}`}
          title="Canlı"
        >
          <span className="flex items-center justify-center gap-1 w-full">
            <Activity size={16} />
            <span>Canlı</span>
          </span>
        </button>

        <button
          onClick={setFav}
          className={`btn-fancy flex-1 text-sm ${activeFilter === "fav" ? "btn-yellow" : ""}`}
          title="Favoriler"
        >
          <span className="flex items-center justify-center gap-1 w-full">
            <Star size={16} />
            <span>Favoriler</span>
          </span>
        </button>

        <button
          onClick={toggleAllLeagues}
          className="btn-fancy flex-1 text-sm"
          title="Tüm Ligleri Aç/Kapat"
        >
          <span className="flex items-center justify-center gap-1 w-full">
            {allOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>Tümü</span>
          </span>
        </button>
      </div>
    </>
  );
}