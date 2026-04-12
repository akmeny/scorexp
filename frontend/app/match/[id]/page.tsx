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
          <p>Bu ma\u00E7 kimli\u011Fi ge\u00E7erli de\u011Fil.</p>
          <Link href="/" className="secondary-link">
            Canl\u0131 skorlara d\u00F6n
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
          <p>Bu canl\u0131 ma\u00E7 \u015Fu anda kullan\u0131lam\u0131yor.</p>
          <Link href="/" className="secondary-link">
            Canl\u0131 skorlara d\u00F6n
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
