import Link from "next/link";
import { LiveMatchDetailPage } from "@/components/live-match-detail-page";
import { fetchMatchById } from "@/lib/api";

export const dynamic = "force-dynamic";

interface MatchPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function MatchPage({ params }: MatchPageProps) {
  const { id } = await params;
  const matchId = Number(id);

  if (!Number.isInteger(matchId) || matchId <= 0) {
    return (
      <main className="page-shell">
        <section className="empty-card">
          <p>That match id is not valid.</p>
          <Link href="/" className="secondary-link">
            Back to live scores
          </Link>
        </section>
      </main>
    );
  }

  const payload = await fetchMatchById(matchId);

  if (!payload?.match) {
    return (
      <main className="page-shell">
        <section className="empty-card">
          <p>That live match is not available right now.</p>
          <Link href="/" className="secondary-link">
            Back to live scores
          </Link>
        </section>
      </main>
    );
  }

  return (
    <LiveMatchDetailPage
      initialMatch={payload.match}
      initialRemoved={false}
    />
  );
}
