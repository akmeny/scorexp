import type { NormalizedMatch } from "../types";

export function formatMatchStatusLabel(match: NormalizedMatch) {
  if (match.status.group === "finished") return "Bitti";
  if (match.status.group === "upcoming") return match.localTime;

  if (match.status.group === "live") {
    const description = match.status.description.toLowerCase();
    if (description === "half time") return "Devre";
    if (description === "penalties") return "Penalti";

    const minute = match.status.minute;
    if (minute === null) return "Canli";
    return formatLiveMinute(match, description, minute);
  }

  return match.localTime || "-";
}

export function shouldShowLiveMinuteTick(match: NormalizedMatch) {
  if (match.status.group !== "live") return false;
  const description = match.status.description.toLowerCase();
  return match.status.minute !== null && description !== "half time" && description !== "penalties";
}

function formatLiveMinute(match: NormalizedMatch, description: string, minute: number) {
  const normalizedMinute = Math.max(0, Math.floor(minute));
  const addedTime = match.status.addedTime ?? null;
  const addedTimeSuffix = addedTime && addedTime > 0 ? ` (+${addedTime})` : "";

  if (description === "first half") {
    const stoppage = normalizedMinute > 45 ? normalizedMinute - 45 : normalizedMinute === 45 ? firstHalfStoppageFromKickoff(match) : 0;
    return stoppage > 0 ? `45+${stoppage}${addedTimeSuffix}` : `${normalizedMinute}${addedTimeSuffix}`;
  }

  if (description === "second half") {
    const elapsedMinute = normalizedMinute <= 45 ? 45 + Math.max(1, normalizedMinute) : normalizedMinute;
    const stoppage = elapsedMinute > 90 ? elapsedMinute - 90 : elapsedMinute === 90 ? secondHalfStoppageFromKickoff(match) : 0;
    return stoppage > 0 ? `90+${stoppage}${addedTimeSuffix}` : `${elapsedMinute}${addedTimeSuffix}`;
  }

  if (normalizedMinute > 90) return `90+${normalizedMinute - 90}${addedTimeSuffix}`;
  if (normalizedMinute > 45 && normalizedMinute < 90) return String(normalizedMinute);
  return `${normalizedMinute}${addedTimeSuffix}`;
}

function firstHalfStoppageFromKickoff(match: NormalizedMatch) {
  const elapsed = elapsedMinutesFromKickoff(match);
  if (elapsed === null || elapsed <= 45) return 0;
  return Math.min(15, elapsed - 45);
}

function secondHalfStoppageFromKickoff(match: NormalizedMatch) {
  const elapsed = elapsedMinutesFromKickoff(match);
  if (elapsed === null || elapsed <= 105) return 0;
  return Math.min(20, elapsed - 105);
}

function elapsedMinutesFromKickoff(match: NormalizedMatch) {
  const startedAt = Number.isFinite(match.timestamp) ? match.timestamp : Date.parse(match.date);
  if (!Number.isFinite(startedAt)) return null;

  const elapsed = Math.floor((Date.now() - startedAt) / 60_000);
  return elapsed >= 0 ? elapsed : null;
}
