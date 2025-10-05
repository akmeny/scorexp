// src/components/ChatModal.jsx
import React, { useEffect, useState } from "react";
import ChatRoomSticky from "./ChatRoomSticky";
import { X, ChevronDown } from "lucide-react";

export default function ChatModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = (e) => setOpen(true);
    const onClose = (e) => setOpen(false);
    window.addEventListener("scorexp:chatOpen", onOpen);
    window.addEventListener("scorexp:chatClose", onClose);
    return () => {
      window.removeEventListener("scorexp:chatOpen", onOpen);
      window.removeEventListener("scorexp:chatClose", onClose);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="sm:hidden fixed inset-0 z-[60]">
      {/* Arkaplan */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      {/* Kart */}
      <div className="
        absolute inset-x-0 bottom-0 top-0
        m-2 rounded-2xl overflow-hidden
        bg-white dark:bg-gray-900
        border border-gray-200 dark:border-gray-800
        shadow-2xl
        flex flex-col
      ">
        {/* Başlık / kapatma */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="text-base font-semibold">Sohbet (global)</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full
                         bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                         active:scale-95 transition"
              aria-label="Kapat"
              title="Kapat"
            >
              <X size={18} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-9 h-9 flex items-center justify-center rounded-full
                         bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                         active:scale-95 transition"
              aria-label="Aşağı indir"
              title="Aşağı indir"
            >
              <ChevronDown size={18} />
            </button>
          </div>
        </div>

        {/* İçerik */}
        <div className="flex-1 min-h-0">
          {/* Mevcut chat bileşenini aynen kullanıyoruz */}
          <ChatRoomSticky room="global" />
        </div>
      </div>
    </div>
  );
}