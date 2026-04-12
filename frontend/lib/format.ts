import type { LiveMatch, MatchEventSummaryItem } from "@/lib/types";

const kickoffFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const kickoffClockFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function formatKickoff(iso: string): string {
  return kickoffFormatter.format(new Date(iso));
}

export function formatLastUpdated(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatMinute(match: LiveMatch): string {
  if (["1H", "2H", "ET", "BT"].includes(match.statusShort) && match.minute !== null) {
    return `${match.minute}'`;
  }

  if (match.statusShort === "P") {
    return "Penaltı Atışları";
  }

  if (match.statusShort === "HT") {
    return "Devre";
  }

  if (match.statusShort === "PEN") {
    return "Pen.";
  }

  if (match.statusShort === "FT" || match.statusShort === "AET") {
    return "Bitti";
  }

  if (match.statusShort === "INT" || match.statusShort === "SUSP") {
    return "Durdu";
  }

  if (["PST", "CANC", "ABD", "AWD", "WO"].includes(match.statusShort)) {
    return "İptal";
  }

  if (match.statusShort === "NS" || match.statusShort === "TBD") {
    return kickoffClockFormatter.format(new Date(match.startTime)).replace(":", ".");
  }

  if (match.minute !== null) {
    return `${match.minute}'`;
  }

  return match.statusLong;
}

export function formatEventLine(event: MatchEventSummaryItem): string {
  const minute = event.minute !== null ? `${event.minute}` : "-";
  const extra = event.extraMinute ? `+${event.extraMinute}` : "";
  const player = event.playerName ? ` ${event.playerName}` : "";
  const team = event.teamName ? `${event.teamName} ` : "";

  return `${minute}${extra}' ${team}${event.type}${player} - ${event.detail}`;
}

export function getStatusTone(statusShort: string): string {
  if (statusShort === "HT") {
    return "is-break";
  }

  if (["1H", "2H", "ET", "BT", "P"].includes(statusShort)) {
    return "is-live";
  }

  return "is-muted";
}
