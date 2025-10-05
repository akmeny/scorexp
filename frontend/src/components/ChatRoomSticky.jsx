// frontend/src/components/ChatRoomSticky.jsx
import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Smile } from "lucide-react";

// Vite proxy sayesinde "/" -> backend'e gider (ws dahil)
const socket = io("/", { path: "/socket.io", transports: ["websocket", "polling"] });

export default function ChatRoomSticky({ room = "global", matchTitle = "" }) {
  const [open, setOpen] = useState(true);
  const [online, setOnline] = useState(0);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [lastSpecialSent, setLastSpecialSent] = useState(0);

  const listRef = useRef(null);

  // Socket eventleri
  useEffect(() => {
    const onOnline = (n) => setOnline(n);
    socket.on("onlineCount", onOnline);

    const onMsg = (msg) => setMessages((p) => [...p, msg]);

    if (room === "global") {
      socket.on("globalChatHistory", (hist) => setMessages(hist));
      socket.on("newGlobalMessage", onMsg);
    } else if (room.startsWith("match:")) {
      const matchId = room.split(":")[1];
      socket.emit("joinMatch", matchId);
      socket.on("matchChatHistory", (hist) => setMessages(hist));
      socket.on("newMatchMessage", onMsg);
    }

    return () => {
      socket.off("onlineCount", onOnline);
      socket.off("newGlobalMessage");
      socket.off("newMatchMessage");
      socket.off("globalChatHistory");
      socket.off("matchChatHistory");
    };
  }, [room]);

  // Her yeni mesajda alta kaydır
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // Normal mesaj
  const send = () => {
    const clean = text.trim().slice(0, 140);
    if (!clean) return;

    const msg = { text: clean, userId: "guest", ts: Date.now() };
    if (room === "global") socket.emit("sendGlobalMessage", msg);
    else if (room.startsWith("match:")) {
      const matchId = room.split(":")[1];
      socket.emit("sendMatchMessage", { ...msg, matchId });
    }
    setText("");
  };

  // Özel mesaj (cooldown: 60sn)
  const sendSpecial = () => {
    const now = Date.now();
    if (now - lastSpecialSent < 60000) return;
    setLastSpecialSent(now);

    const specialMsg = "🥅⚽🔥  Penaltıcılar Geldi!  🔥⚽🥅";
    const msg = { text: specialMsg, userId: "guest", ts: now, special: true };

    if (room === "global") socket.emit("sendGlobalMessage", msg);
    else if (room.startsWith("match:")) {
      const matchId = room.split(":")[1];
      socket.emit("sendMatchMessage", { ...msg, matchId });
    }
  };

  return (
    <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Başlık */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {room === "global" ? "Sohbet (global)" : "Sohbet (maç)"}
          </span>
          {matchTitle && <span className="text-xs opacity-70">— {matchTitle}</span>}
          <span className="flex items-center gap-1 text-sm opacity-80 ml-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-blink" />
            {online}
          </span>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          title={open ? "Yukarı kapat" : "Aşağı aç"}
        >
          {open ? "▲" : "▼"}
        </button>
      </div>

      {/* İçerik (mesajlar + input) */}
      <div
        className={`transition-all duration-500 overflow-hidden flex flex-col ${
          open ? "flex-1 max-h-[1000px]" : "max-h-0"
        }`}
      >
        {/* Mesaj listesi — altta sticky input için yastık */}
        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 pb-28"
        >
          {messages.map((m, i) => {
            const isMe = m.userId === "guest";
            if (m.special) {
              return (
                <div key={i} className="w-full flex justify-center">
                  <div className="special-msg animate-shake text-sm font-bold py-2 px-4 rounded-lg text-center">
                    {m.text}
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div
                  className={`px-3 py-2 rounded-lg text-sm max-w-[70%] break-words ${
                    isMe
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-black dark:text-white"
                  }`}
                >
                  {!isMe && (
                    <span className="text-xs opacity-60 block mb-1">
                      {m.userId || "guest"}
                    </span>
                  )}
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input alanı — mobilde alt barın HEMEN üstünde sabit */}
        <div className="sticky bottom-0 left-0 right-0 z-10 mb-[84px] sm:mb-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm">
            <button
              onClick={() => setText((t) => (t + "😀").slice(0, 140))}
              className="px-2 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              title="Emoji"
            >
              <Smile size={18} />
            </button>
            <button
              onClick={sendSpecial}
              className="px-3 py-2 rounded bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold shadow hover:scale-105 transition text-xs"
              title="Penaltıcılar Geldi!"
            >
              Penaltıcılar Geldi!
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={140}
              placeholder="Mesaj yaz..."
              className="flex-1 px-3 py-2 rounded bg-gray-50 dark:bg-gray-900 outline-none"
            />
            <button
              onClick={send}
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Gönder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}