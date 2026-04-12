import { LiveScoresClient } from "@/components/live-scores-client";
import { fetchTodayMatchesSnapshotSafe } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshot = await fetchTodayMatchesSnapshotSafe();

  return <LiveScoresClient initialSnapshot={snapshot} />;
}
