import React, { useState } from "react";
import { Sun, Moon, User, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

const sports = ["⚽", "🏀", "🎾", "🏐"];
const monthNames = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
  "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"
];

export default function MobileHeader() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [sportIdx, setSportIdx] = useState(0);
  const today = new Date();
  const [date, setDate] = useState(today);

  const shiftDay = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    const diffDays = Math.round((d - today) / (1000*60*60*24));
    if (diffDays < -30 || diffDays > 30) return;
    setDate(d);
    const val = d.toISOString().split("T")[0];
    window.dispatchEvent(new CustomEvent("scorexp:setDate", { detail: val }));
  };

  const formattedDate = `${date.getDate()} ${monthNames[date.getMonth()]}`;

  return (
    <div className="sm:hidden fixed top-0 left-0 right-0 z-50
      mx-2 mt-2 rounded-2xl shadow-lg
      bg-white/90 dark:bg-gray-900/90 backdrop-blur
      border border-gray-200 dark:border-gray-800
      px-3 py-2 flex items-center justify-between gap-2">
      
      {/* Sol: Logo */}
      <div className="text-lg font-extrabold tracking-tight 
        bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 
        bg-clip-text text-transparent select-none">
        score<span className="lowercase">xp</span>
      </div>

      {/* Spor seçici (küçük) */}
      <button
        onClick={() => {
          const next = (sportIdx + 1) % sports.length;
          setSportIdx(next);
          window.dispatchEvent(new CustomEvent("scorexp:setSport", { detail: sports[next] }));
        }}
        className="text-xl transform scale-75 hover:scale-90 transition"
        title="Spor Dalı"
      >
        {sports[sportIdx]}
      </button>

      {/* Gün değiştirici */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => shiftDay(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-full
            bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
            transition shadow-sm active:scale-95"
          title="Önceki Gün"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="min-w-[72px] text-center text-sm font-medium truncate">
          {formattedDate}
        </span>

        <button
          onClick={() => shiftDay(1)}
          className="w-8 h-8 flex items-center justify-center rounded-full
            bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
            transition shadow-sm active:scale-95"
          title="Sonraki Gün"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Sağ: Tema + Profil */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 flex items-center justify-center rounded-full
            bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
            transition shadow-md active:scale-95"
          title="Tema"
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-full
            bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
            transition shadow-md active:scale-95"
          title="Profil"
        >
          <User size={18} />
        </button>
      </div>
    </div>
  );
}