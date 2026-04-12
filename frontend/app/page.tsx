import { LiveScoresClient } from "@/components/live-scores-client";
import { fetchLiveMatchesSnapshotSafe } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshot = await fetchLiveMatchesSnapshotSafe();

  return <LiveScoresClient initialSnapshot={snapshot} />;
}
