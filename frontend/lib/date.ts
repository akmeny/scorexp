const scoreboardTimeZone = "Europe/Istanbul";

function parseDateKey(dateKey: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

export function getScoreboardDateKey(date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: scoreboardTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const lookup = new Map(parts.map((part) => [part.type, part.value]));
    const year = lookup.get("year");
    const month = lookup.get("month");
    const day = lookup.get("day");

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through to UTC fallback.
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDateLabel(dateKey: string): string {
  const parsed = parseDateKey(dateKey);

  if (!parsed) {
    return dateKey;
  }

  return `${String(parsed.day).padStart(2, "0")}.${String(parsed.month).padStart(2, "0")}.${parsed.year}`;
}

export function offsetDateKey(dateKey: string, deltaDays: number): string {
  const parsed = parseDateKey(dateKey);

  if (!parsed) {
    return dateKey;
  }

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  date.setUTCDate(date.getUTCDate() + deltaDays);

  return getScoreboardDateKey(date);
}

export function isTodayDateKey(dateKey: string): boolean {
  return dateKey === getScoreboardDateKey();
}

export function isValidDateKey(dateKey: string): boolean {
  return parseDateKey(dateKey) !== null;
}
