// frontend/src/hooks/useLiveSocket.js
import { useEffect, useRef, useState } from "react";

/**
 * Canlı veri için önce SSE, istenirse sonra WebSocket dener.
 * onFixtureUpdate(fid, payload): tekil fikstür güncellemesini parent'a geçirir.
 *
 * Parametreler:
 *  - enabled: boolean
 *  - onFixtureUpdate: function(fid, payload)
 *  - tryWS: boolean (default: true) — WS fallback'ını aç/kapat
 */
export default function useLiveSocket({ enabled, onFixtureUpdate, tryWS = true }) {
  const sseRef = useRef(null);
  const wsRef = useRef(null);
  const closedRef = useRef(false);
  const [mode, setMode] = useState(null); // 'sse' | 'ws' | null

  useEffect(() => {
    if (!enabled) return;
    closedRef.current = false;

    const process = (raw) => {
      try {
        const msg = typeof raw === "string" ? JSON.parse(raw) : raw;
        const payload = msg?.payload || msg?.data || msg;
        const fid =
          payload?.fixture ||
          payload?.fixtureId ||
          payload?.id ||
          payload?.fixture?.id;
        if (!fid) return;
        if (typeof onFixtureUpdate === "function") onFixtureUpdate(fid, payload);
      } catch {}
    };

    const openWS = (url) =>
      new Promise((resolve, reject) => {
        try {
          const ws = new WebSocket(url);
          wsRef.current = ws;
          ws.onopen = () => {
            if (closedRef.current) { try { ws.close(); } catch {} return; }
            setMode("ws"); resolve("ws");
          };
          ws.onmessage = (e) => process(e.data);
          ws.onerror = () => {};
          ws.onclose = () => {};
        } catch (e) { reject(e); }
      });

    const openSSE = () =>
      new Promise((resolve, reject) => {
        try {
          const es = new EventSource("/api/live-sse");
          sseRef.current = es;
          es.onopen = () => {
            if (closedRef.current) { try { es.close(); } catch {} return; }
            setMode("sse"); resolve("sse");
          };
          es.onmessage = (e) => process(e.data);
          es.addEventListener?.("fixture", (e) => process(e.data));
          es.onerror = () => { try { es.close(); } catch {}; sseRef.current = null; reject(new Error("sse-failed")); };
        } catch (e) { reject(e); }
      });

    (async () => {
      try {
        await openSSE();
      } catch {
        if (!tryWS) return;
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        const host = window.location.host;
        const tryUrls = [`${proto}://${host}/api/ws`, `${proto}://${host}/ws`];
        for (const u of tryUrls) {
          try { await openWS(u); break; } catch {}
        }
      }
    })();

    return () => {
      closedRef.current = true;
      try { sseRef.current?.close?.(); } catch {}
      try { wsRef.current?.close?.(); } catch {}
      sseRef.current = null; wsRef.current = null; setMode(null);
    };
  }, [enabled, onFixtureUpdate, tryWS]);

  return mode; // 'sse' | 'ws' | null
}