// frontend/src/hooks/useChatRoom.js
import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "../useSocket";

/**
 * Tek hook ile hem global hem maç sohbetini yönetir.
 * room: "global" | `match:${fixtureId}`
 *
 * DÖNEN API:
 * - online: number            -> çevrimiçi kişi
 * - messages: array           -> mesaj listesi (history + yeni mesajlar)
 * - sendMessage(text)         -> normal mesaj gönder (140 char sınırını uygular)
 * - sendSpecial(text?)        -> özel mesaj (cooldown: 60sn)
 * - clear()                   -> mesajları sıfırla (opsiyonel)
 * - canSendSpecial: boolean   -> cooldown durumu
 * - lastSpecialTs: number     -> son özel mesaj zamanı (ms)
 */
export default function useChatRoom(room = "global") {
  const socketRef = useRef(null);
  const roomRef = useRef(room);

  const [online, setOnline] = useState(0);
  const [messages, setMessages] = useState([]);
  const [lastSpecialTs, setLastSpecialTs] = useState(0);

  // socket init (tekil)
  useEffect(() => {
    socketRef.current = getSocket();
  }, []);

  // odaya bağlan / event abonelikleri
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    roomRef.current = room;

    const onOnline = (n) => setOnline(n);
    s.on("onlineCount", onOnline);

    // gelen mesajları tek handler ile ekle
    const pushMsg = (msg) => setMessages((p) => [...p, msg]);

    if (room === "global") {
      s.on("globalChatHistory", (hist) => setMessages(Array.isArray(hist) ? hist : []));
      s.on("newGlobalMessage", pushMsg);
      // history talebi gerekiyorsa backend otomatik yayınlıyordur;
      // değilse burada s.emit("getGlobalHistory") diyebilirdik.
    } else if (room.startsWith("match:")) {
      const matchId = room.split(":")[1];
      s.emit("joinMatch", matchId);
      s.on("matchChatHistory", (hist) => setMessages(Array.isArray(hist) ? hist : []));
      s.on("newMatchMessage", pushMsg);
    }

    return () => {
      s.off("onlineCount", onOnline);
      s.off("globalChatHistory");
      s.off("newGlobalMessage");
      s.off("matchChatHistory");
      s.off("newMatchMessage");
      // İsteğe bağlı: ayrılma emit'i varsa kullan
      // if (roomRef.current.startsWith("match:")) {
      //   s.emit("leaveMatch", roomRef.current.split(":")[1]);
      // }
    };
  }, [room]);

  const sendMessage = useCallback((text) => {
    const s = socketRef.current;
    if (!s) return;

    const clean = String(text || "").trim().slice(0, 140);
    if (!clean) return;

    const base = { text: clean, userId: "guest", ts: Date.now() };

    if (roomRef.current === "global") {
      s.emit("sendGlobalMessage", base);
    } else if (roomRef.current.startsWith("match:")) {
      const matchId = roomRef.current.split(":")[1];
      s.emit("sendMatchMessage", { ...base, matchId });
    }
  }, []);

  const sendSpecial = useCallback((text = "🥅⚽🔥  Penaltıcılar Geldi!  🔥⚽🥅") => {
    const now = Date.now();
    if (now - lastSpecialTs < 60000) return; // 60sn cooldown
    setLastSpecialTs(now);

    const s = socketRef.current;
    if (!s) return;

    const base = { text, userId: "guest", ts: now, special: true };

    if (roomRef.current === "global") {
      s.emit("sendGlobalMessage", base);
    } else if (roomRef.current.startsWith("match:")) {
      const matchId = roomRef.current.split(":")[1];
      s.emit("sendMatchMessage", { ...base, matchId });
    }
  }, [lastSpecialTs]);

  const clear = useCallback(() => setMessages([]), []);

  return {
    online,
    messages,
    sendMessage,
    sendSpecial,
    clear,
    lastSpecialTs,
    canSendSpecial: Date.now() - lastSpecialTs >= 60000,
  };
}
