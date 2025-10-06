// frontend/src/components/SegmentBar.jsx
import React from "react";
import { motion } from "framer-motion";
import { CalendarDays, Activity, Star, ChevronUp, ChevronDown } from "lucide-react";

export default function SegmentBar({ active, onChange, allOpen, toggleAll }) {
  const tabs = [
    { key: "today", label: "Bugün", icon: CalendarDays, color: "from-blue-500 to-blue-600", text: "white" },
    { key: "live", label: "Canlı", icon: Activity, color: "from-red-500 to-red-600", text: "white" },
    { key: "fav", label: "Favoriler", icon: Star, color: "from-yellow-400 to-yellow-500", text: "black" },
    { key: "all", label: allOpen ? "Kapat" : "Aç", icon: allOpen ? ChevronUp : ChevronDown, color: "from-gray-400 to-gray-500", text: "white" },
  ];

  return (
    <div className="relative flex justify-around bg-white/90 dark:bg-gray-900/90 rounded-2xl p-1 shadow-md border border-gray-200 dark:border-gray-700 backdrop-blur">
      {tabs.map((t) => {
        const isActive = active === t.key;
        const Icon = t.icon;

        // Aktif olan için text rengini belirle
        const textClass = isActive
          ? t.text === "white"
            ? "text-white"
            : "text-black"
          : "text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white";

        return (
          <button
            key={t.key}
            onClick={() => {
              if (t.key === "all") toggleAll();
              else onChange(t.key);
            }}
            className={`relative flex-1 py-2 text-xs sm:text-sm font-medium transition-colors rounded-xl z-10`}
          >
            {isActive && (
              <motion.span
                layoutId="segment-pill"
                className={`absolute inset-0 rounded-xl bg-gradient-to-r ${t.color} shadow`}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span className={`relative z-10 flex items-center justify-center gap-1 ${textClass}`}>
              <Icon size={16} />
              <span>{t.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
