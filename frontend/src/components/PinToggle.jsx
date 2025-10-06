// src/components/PinToggle.jsx
import React from "react";
import { Check } from "lucide-react";

/**
 * Sağ üstte (lig başlığında) kullandığın "çentik" ikonunu bununla bağla.
 * active=true: sabit, false: sabit değil
 */
export default function PinToggle({ active, onClick, title = "Sabit / Kaldır" }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      title={title}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition
        ${active
          ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
          : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
        }`}
    >
      <Check size={16} />
    </button>
  );
}