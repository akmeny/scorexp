// src/components/ChatFab.jsx
import React from "react";

// Event ile modali açıyoruz
export default function ChatFab() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("scorexp:chatOpen", { detail: true }))}
      className="
        sm:hidden fixed z-50
        right-4 bottom-[92px]    /* alt bardan yukarıda dursun */
        w-12 h-12 rounded-full
        bg-white/90 dark:bg-gray-900/90 backdrop-blur
        border border-gray-200 dark:border-gray-800
        shadow-xl active:scale-95 transition
        flex items-center justify-center
      "
      aria-label="Sohbeti Aç"
      title="Sohbet"
    >
      {/* Konuşma balonu */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           className="text-gray-800 dark:text-gray-100">
        <path d="M21 12a7 7 0 0 1-7 7H8l-5 3 1.5-4.5A7 7 0 0 1 3 12a7 7 0 0 1 7-7h4a7 7 0 0 1 7 7Z"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}