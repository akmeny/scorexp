import { formatTranslatedEventLine, translateStatusLong } from "@/lib/i18n";
import type { LiveMatch, MatchEventSummaryItem } from "@/lib/types";

const kickoffFormatter = new Intl.DateTimeFormat("tr-TR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const kickoffClockFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
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
    return "Penalt\u0131 At\u0131\u015Flar\u0131";
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
    return "\u0130ptal";
  }

  if (match.statusShort === "NS" || match.statusShort === "TBD") {
    return kickoffClockFormatter.format(new Date(match.startTime)).replace(":", ".");
  }

  if (match.minute !== null) {
    return `${match.minute}'`;
  }

  return translateStatusLong(match.statusShort, match.statusLong);
}

export function formatEventLine(event: MatchEventSummaryItem): string {
  return formatTranslatedEventLine(event);
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
