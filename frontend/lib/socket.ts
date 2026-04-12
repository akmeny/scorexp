"use client";

import { io, type Socket } from "socket.io-client";
import { clientLogger } from "@/lib/logger";

const DEFAULT_SOCKET_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.scorexp.com"
    : "http://localhost:4000";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/+$/, "") ??
  DEFAULT_SOCKET_URL;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    clientLogger.info("Creating Socket.IO client", {
      url: SOCKET_URL,
    });

    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2500,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.55,
      timeout: 10000,
    });
  }

  return socket;
}
