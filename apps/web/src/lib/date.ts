export function todayInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T12:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function dateLabel(date: string, timezone: string) {
  const today = todayInTimezone(timezone);
  if (date === today) return "Bugün";
  if (date === shiftDate(today, -1)) return "Dün";
  if (date === shiftDate(today, 1)) return "Yarın";

  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short"
  }).format(new Date(`${date}T12:00:00.000Z`));
}
