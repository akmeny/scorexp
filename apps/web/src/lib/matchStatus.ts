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
    return formatLiveMinute(description, minute);
  }

  return match.localTime || "-";
}

export function shouldShowLiveMinuteTick(match: NormalizedMatch) {
  if (match.status.group !== "live") return false;
  const description = match.status.description.toLowerCase();
  return match.status.minute !== null && description !== "half time" && description !== "penalties";
}

function formatLiveMinute(description: string, minute: number) {
  const normalizedMinute = Math.max(0, Math.floor(minute));

  if (description === "first half") {
    return normalizedMinute <= 45 ? String(normalizedMinute) : `45 +${normalizedMinute - 45}`;
  }

  if (description === "second half") {
    const elapsedMinute = normalizedMinute <= 45 ? 45 + Math.max(1, normalizedMinute) : normalizedMinute;
    return elapsedMinute <= 90 ? String(elapsedMinute) : `90 +${elapsedMinute - 90}`;
  }

  if (normalizedMinute > 90) return `90 +${normalizedMinute - 90}`;
  if (normalizedMinute > 45 && normalizedMinute < 90) return String(normalizedMinute);
  return String(normalizedMinute);
}
