import { BrainCircuit, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMatchDetail } from "../hooks/useMatchDetail";
import type { MatchDetail, MatchDetailPrediction, NormalizedMatch } from "../types";

interface AiPredictionModalProps {
  match: NormalizedMatch;
  timezone: string;
  onRequestClose: () => void;
}

type AiModalStatus = "analyzing" | "done";

const modalAnalysisSteps = [
  "Maç ritmi okunuyor...",
  "Son skor hareketleri inceleniyor...",
  "Form ve puan sinyalleri tartılıyor...",
  "Ev/deplasman etkisi hesaplanıyor...",
  "Oyuncu ve olay verileri eşleştiriliyor...",
  "aiXp tahmini hazırlanıyor..."
];

export function AiPredictionModal({ match, timezone, onRequestClose }: AiPredictionModalProps) {
  const [status, setStatus] = useState<AiModalStatus>("analyzing");
  const [step, setStep] = useState(0);
  const detailState = useMatchDetail(match.providerId, timezone);
  const result = useMemo(() => buildAiModalResult(match, detailState.data), [detailState.data, match]);
  const progress = status === "done" ? 100 : Math.round(((step + 1) / modalAnalysisSteps.length) * 100);
  const canClose = status === "done";

  useEffect(() => {
    setStatus("analyzing");
    setStep(0);
  }, [match.id]);

  useEffect(() => {
    if (status !== "analyzing") return;

    const interval = window.setInterval(() => {
      setStep((current) => {
        const next = current + 1;
        if (next >= modalAnalysisSteps.length) {
          window.clearInterval(interval);
          setStatus("done");
          return modalAnalysisSteps.length - 1;
        }
        return next;
      });
    }, 850);

    return () => window.clearInterval(interval);
  }, [status]);

  const close = () => {
    if (canClose) onRequestClose();
  };

  return (
    <div
      className={`aiPredictionOverlay ${canClose ? "closable" : "locked"}`}
      role="dialog"
      aria-modal="true"
      aria-label="aiXp tahmin penceresi"
      onClick={(event) => {
        if (event.currentTarget === event.target) close();
      }}
    >
      <section className={`aiPredictionModal ${status}`}>
        <header className="aiModalHeader">
          <span>
            <BrainCircuit size={16} />
            aiXp Tahmin
          </span>
          <button
            className="aiModalClose"
            type="button"
            aria-label="Kapat"
            aria-disabled={!canClose}
            disabled={!canClose}
            onClick={close}
          >
            <X size={16} />
          </button>
        </header>

        <div className="aiModalTeams">
          <strong title={match.homeTeam.name}>{match.homeTeam.name}</strong>
          <span>{formatScoreline(match)}</span>
          <strong title={match.awayTeam.name}>{match.awayTeam.name}</strong>
        </div>

        {status === "analyzing" ? (
          <div className="aiModalAnalysis">
            <div className="aiModalScanner" aria-hidden="true">
              <span />
            </div>
            <p aria-live="polite">{modalAnalysisSteps[step]}</p>
            <div className="aiModalProgress" aria-hidden="true">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div className="aiModalResult">
            <span>
              <Sparkles size={15} />
              Simülasyon tamamlandı
            </span>
            <strong>{result.title}</strong>
            <p>{result.summary}</p>
            {result.probabilities ? (
              <div className="aiModalBars">
                {result.probabilities.map((item) => (
                  <div className={item.key} key={item.label}>
                    <span>{item.label}</span>
                    <b>{item.value}</b>
                    <i style={{ width: item.value }} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function buildAiModalResult(match: NormalizedMatch, detail: MatchDetail | null) {
  const activeMatch = detail?.match ?? match;
  const prediction = detail?.predictions.latestLive ?? detail?.predictions.latestPrematch ?? null;
  const predictionResult = prediction ? resultFromPrediction(activeMatch, prediction) : null;

  if (predictionResult) return predictionResult;

  return {
    title: "Tahmin üretilemedi",
    summary: "aiXp Tahmin Simülasyonu veri yetersizliği nedeniyle bu maç için tahmin üretmemiştir.",
    probabilities: null
  };
}

function resultFromPrediction(match: NormalizedMatch, prediction: MatchDetailPrediction) {
  const probabilities = [
    { key: "home", label: "1", team: match.homeTeam.name, value: prediction.probabilities.home },
    { key: "draw", label: "X", team: "Beraberlik", value: prediction.probabilities.draw },
    { key: "away", label: "2", team: match.awayTeam.name, value: prediction.probabilities.away }
  ]
    .map((item) => ({ ...item, number: parsePercent(item.value) }))
    .filter((item) => item.number !== null);

  if (probabilities.length === 0) return null;

  const leader = [...probabilities].sort((a, b) => (b.number ?? 0) - (a.number ?? 0))[0];
  const confidence = leader.number && leader.number >= 60 ? "yüksek" : leader.number && leader.number >= 50 ? "orta" : "dengeli";

  return {
    title: `${leader.team} öne çıkıyor`,
    summary: `aiXp, mevcut veri setinde ${leader.team} tarafını ${leader.value} ile önde görüyor. Güven seviyesi ${confidence}.`,
    probabilities: probabilities.map((item) => ({ key: item.key, label: item.label, value: item.value ?? "0%" }))
  };
}

function parsePercent(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatScoreline(match: NormalizedMatch) {
  if (match.score.home === null || match.score.away === null) return match.localTime;
  return `${match.score.home}-${match.score.away}`;
}
