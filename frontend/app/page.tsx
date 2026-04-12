import { LiveScoresClient } from "@/components/live-scores-client";
import type { MatchesSnapshotViewModel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const snapshot: MatchesSnapshotViewModel = {
    matches: [],
    generatedAt: new Date().toISOString(),
    total: 0,
    error: null,
  };

  return <LiveScoresClient initialSnapshot={snapshot} />;
}
