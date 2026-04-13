import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Android Yukleme | ScoreXP",
  description: "ScoreXP Android yukleme ve ana ekrana ekleme adimlari.",
};

const installSteps = [
  {
    title: "Tarayici menusu",
    body: 'Chrome veya Samsung Internet icinde sag ust menuyu acip "Uygulamayi yukle" ya da "Ana ekrana ekle" secenegini kullan.',
  },
  {
    title: "Yukleme onayi",
    body: "Android sana yukleme penceresi gosterirse onay ver. ScoreXP daha hizli ve uygulama gibi acilir.",
  },
  {
    title: "Daha sonra devam",
    body: "Dogrudan APK veya store baglantisi hazir oldugunda bu sayfa ayni yerden guncellenecek.",
  },
] as const;

export default function AndroidInstallPage() {
  return (
    <main className="page-shell android-install-page">
      <section className="android-install-card">
        <div className="android-install-topline">
          <Link href="/" className="scorexp-brand-button android-install-brand">
            ScoreXP
          </Link>
          <span className="android-install-badge">Android</span>
        </div>

        <div className="android-install-hero">
          <p className="android-install-kicker">Hizli erisim</p>
          <h1>ScoreXP&apos;yi Android cihazina ekle</h1>
          <p>
            Bu sayfa Android kullanicilari icin hizli yukleme rehberi olarak hazirlandi.
            Ana ekrana eklediginde ScoreXP daha pratik acilir ve uygulama hissi verir.
          </p>
        </div>

        <section className="android-install-grid" aria-label="Android yukleme adimlari">
          {installSteps.map((step, index) => (
            <article key={step.title} className="android-install-step">
              <span className="android-install-step-index">0{index + 1}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </article>
          ))}
        </section>

        <div className="android-install-actions">
          <Link href="/" className="secondary-link android-install-link">
            Skor ekranina don
          </Link>
        </div>
      </section>
    </main>
  );
}
