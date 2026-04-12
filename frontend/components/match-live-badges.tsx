import type { MatchNotice } from "@/lib/live-match-presentation";

export function RedCardBadge({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  const safeCount = Number.isFinite(count) ? count : 0;

  if (safeCount <= 0) {
    return null;
  }

  return (
    <span
      className={`red-card-badge ${className}`.trim()}
      aria-label={`${safeCount} kırmızı kart`}
      title={`${safeCount} kırmızı kart`}
    >
      {safeCount}
    </span>
  );
}

export function TeamNoticeBadge({
  notice,
}: {
  notice: MatchNotice | null;
}) {
  if (!notice) {
    return null;
  }

  return (
    <span className={`team-live-notice is-${notice.tone}`}>
      {notice.label}
    </span>
  );
}
