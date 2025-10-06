// frontend/src/components/ChatRoomSticky.jsx
import React, { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import useChatRoom from "../hooks/useChatRoom";
import useBottomInset from "../hooks/useBottomInset"; // ⬅️ yeni

export default function ChatRoomSticky({ room = "global", matchTitle = "" }) {
  const { online, messages, sendMessage, sendSpecial } = useChatRoom(room);
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");

  const listRef = useRef(null);
  const inputWrapRef = useRef(null);

  // Alt bar yüksekliği (mobilde varsa)
  const bottomInset = useBottomInset();

  // Input yüksekliğini ölç (dinamik)
  const [inputH, setInputH] = useState(0);
  useEffect(() => {
    const el = inputWrapRef.current;
    if (!el) return;
    const measure = () => setInputH(el.getBoundingClientRect().height || 0);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Yeni mesajda en alta kay
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const onSend = () => {
    const clean = text.trim();
    if (!clean) return;
    sendMessage(clean);
    setText("");
  };

  // Mesaj listesinin alt boşluğunu dinamik ver (input + alt bar + ufak buffer)
  const listPadBottom = inputH + bottomInset + 12;

  // Mobil alt bar yüksekliği (SegmentBar ≈ 56px)
  const mobileBarHeight = 56;

  // Input’u alt barın hemen üstüne sabitle
  const stickyBottom = bottomInset + mobileBarHeight;

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
        <button onClick={() => setOpen((v) => !v)}>{open ? "▲" : "▼"}</button>
      </div>

      {/* İçerik (mesajlar + input) */}
      <div className={`transition-all duration-500 overflow-hidden flex flex-col ${open ? "flex-1 max-h-[1000px]" : "max-h-0"}`}>
        {/* Mesaj listesi */}
        <div
          ref={listRef}
          className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2"
          style={{ paddingBottom: listPadBottom }}
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
                  {!isMe && <span className="text-xs opacity-60 block mb-1">{m.userId || "guest"}</span>}
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input — alt barın hemen üstünde sticky */}
        <div
          ref={inputWrapRef}
          className="sticky left-0 right-0 z-10 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2"
          style={{ bottom: stickyBottom }}
        >
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl p-2 shadow-sm">
            <button
              onClick={() => setText((t) => (t + "😀").slice(0, 140))}
              className="px-2 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              title="Emoji"
            >
              <Smile size={18} />
            </button>
            <button
              onClick={() => sendSpecial()}
              className="px-3 py-2 rounded bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold shadow hover:scale-105 transition text-xs"
              title="Penaltıcılar Geldi!"
            >
              Penaltıcılar Geldi!
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSend()}
              maxLength={140}
              placeholder="Mesaj yaz..."
              className="flex-1 px-3 py-2 rounded bg-gray-50 dark:bg-gray-900 outline-none"
            />
            <button
              onClick={onSend}
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
