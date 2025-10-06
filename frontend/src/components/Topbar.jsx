import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Sun,
  Moon,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import SegmentBar from "./SegmentBar";

const sports = ["⚽", "🏀", "🎾", "🏐"];

export default function Topbar() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [sportIdx, setSportIdx] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [activeFilter, setActiveFilter] = useState("today");
  const [allOpen, setAllOpen] = useState(true);

  // Alt bar yüksekliğini ölçüp --mbb değişkenine yaz
  useEffect(() => {
    const el = document.getElementById("mobile-bottom-bar");
    const setVar = () => {
      const h = el ? el.getBoundingClientRect().height : 0;
      // Biraz nefes payı ekleyelim (8px marj gibi)
      document.documentElement.style.setProperty("--mbb", `${h + 8}px`);
    };
    setVar();
    if (!el) return () => {};
    const ro = new ResizeObserver(setVar);
    ro.observe(el);
    window.addEventListener("resize", setVar);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", setVar);
    };
  }, []);

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

          {/* Gün kontrolleri */}
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
            Canlı
          </button>

          {/* Favoriler */}
          <button
            className={`btn-fancy ${activeFilter === "fav" ? "btn-yellow" : ""}`}
            onClick={setFav}
          >
            Favoriler
          </button>

          {/* Tüm ligleri aç/kapat */}
          <button className="btn-fancy" onClick={toggleAllLeagues}>
            {allOpen ? "▲" : "▼"}
          </button>

          <div className="flex-1" />

          {/* Sağ ikonlar */}
          <button className="btn-fancy">
            <Search size={16} />
          </button>
          <button onClick={toggleTheme} className="btn-fancy">
            {isDark ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="btn-fancy">
            <User size={16} />
          </button>
        </div>
      </div>

      {/* Mobil Alt Bar — animasyonlu */}
      <div
        id="mobile-bottom-bar"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 mx-2 mb-2"
      >
        <SegmentBar
          active={activeFilter}
          onChange={(key) => {
            if (key === "today") toToday();
            if (key === "live") setLive();
            if (key === "fav") setFav();
          }}
          allOpen={allOpen}
          toggleAll={toggleAllLeagues}
        />
      </div>
    </>
  );
}