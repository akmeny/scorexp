import Link from "next/link";
import { LiveMatchDetailPage } from "@/components/live-match-detail-page";
import { fetchMatchDetailPageData } from "@/lib/api";

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
          <p>Bu maç kimliği geçerli değil.</p>
          <Link href="/" className="secondary-link">
            Canlı skorlara dön
          </Link>
        </section>
      </main>
    );
  }

  const payload = await fetchMatchDetailPageData(matchId);

  if (!payload?.match) {
    return (
      <main className="page-shell">
        <section className="empty-card">
          <p>Bu maç şu anda kullanılamıyor.</p>
          <Link href="/" className="secondary-link">
            Canlı skorlara dön
          </Link>
        </section>
      </main>
    );
  }

  return <LiveMatchDetailPage initialPayload={payload} />;
}
