"use client";

import Link from "next/link";
import { startTransition, useEffect, useEffectEvent, useState } from "react";
import { MatchDetailPanel } from "@/components/match-detail-panel";
import { getSocket } from "@/lib/socket";
import type {
  LiveMatch,
  MatchesSnapshotResponse,
  MatchUpdateEvent,
} from "@/lib/types";

export function LiveMatchDetailPage({
  initialMatch,
  initialRemoved,
}: {
  initialMatch: LiveMatch;
  initialRemoved: boolean;
}) {
  const [match, setMatch] = useState(initialMatch);
  const [removed, setRemoved] = useState(initialRemoved);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");

  const handleSnapshot = useEffectEvent((snapshot: MatchesSnapshotResponse) => {
    const liveMatch =
      snapshot.matches.find((entry) => entry.matchId === initialMatch.matchId) ??
      null;

    startTransition(() => {
      if (liveMatch) {
        setMatch(liveMatch);
        setRemoved(false);
        return;
      }

      setRemoved(true);
    });
  });

  const handleUpdate = useEffectEvent((payload: MatchUpdateEvent) => {
    if (payload.matchId !== initialMatch.matchId) {
      return;
    }

    startTransition(() => {
      if (payload.type === "removed") {
        setRemoved(true);
        return;
      }

      if (payload.type === "added") {
        setMatch(payload.match);
        setRemoved(false);
        return;
      }

      setMatch((currentMatch) => ({
        ...currentMatch,
        ...payload.changes,
      }));
      setRemoved(false);
    });
  });

  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setConnectionStatus("live");
    };

    const onDisconnect = () => {
      setConnectionStatus("reconnecting");
    };

    const onConnectError = () => {
      setConnectionStatus("reconnecting");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("matches:snapshot", handleSnapshot);
    socket.on("match:update", handleUpdate);
    socket.connect();
    socket.emit("match:watch", initialMatch.matchId);

    return () => {
      socket.emit("match:unwatch", initialMatch.matchId);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("matches:snapshot", handleSnapshot);
      socket.off("match:update", handleUpdate);
      socket.disconnect();
    };
  }, []);

  return (
    <main className="page-shell detail-page-shell">
      <section className="hero-card compact">
        <div>
          <Link href="/" className="secondary-link">
            Canlı Skorlara Dön
          </Link>
          <h1 className="page-title small">Canlı Maç Sayfası</h1>
        </div>
        <span
          className={`status-pill ${
            connectionStatus === "live" ? "is-live" : "is-muted"
          }`}
        >
          {connectionStatus === "live"
            ? "Canlı Güncellemeler Açık"
            : "Yeniden Bağlanıyor"}
        </span>
      </section>

      <MatchDetailPanel
        match={removed ? null : match}
        removed={removed}
        matchId={match.matchId}
      />
    </main>
  );
}
