// frontend/src/useSocket.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

let socket;
export function getSocket() {
  if (!socket) {
    socket = io("/", { path: "/socket.io", transports: ["websocket", "polling"] });
  }
  return socket;
}

export default function useSocket(event, handler) {
  const saved = useRef(handler);
  useEffect(() => {
    saved.current = handler;
  }, [handler]);

  useEffect(() => {
    const s = getSocket();
    if (!event) return;
    const fn = (data) => saved.current && saved.current(data);
    s.on(event, fn);
    return () => s.off(event, fn);
  }, [event]);
}