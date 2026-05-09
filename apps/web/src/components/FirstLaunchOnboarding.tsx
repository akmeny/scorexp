import {
  Activity,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  MessageCircle,
  Radio,
  Send,
  Sparkles,
  Star,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type OnboardingVisualKind = "live" | "aixp" | "atmosphere" | "chat" | "personal";

interface OnboardingStep {
  title: string;
  eyebrow: string;
  body: string;
  points: string[];
  visual: OnboardingVisualKind;
  icon: LucideIcon;
  accent: string;
  accentAlt: string;
}

const onboardingStorageKey = "scorexp:onboarding:v1";

const onboardingSteps: OnboardingStep[] = [
  {
    title: "Canlı maç ritmini ilk bakışta yakala",
    eyebrow: "Canlı Skor",
    body: "ScoreXP maç listesini dakika, skor, kart ve gol hareketleriyle canlı tutar. Sadece skora değil, maçın nabzına bakarsın.",
    points: ["Canlı maç filtresi", "Gol değişim vurgusu", "Favori maç takibi"],
    visual: "live",
    icon: Radio,
    accent: "#38bdf8",
    accentAlt: "#fb923c"
  },
  {
    title: "aiXp ile olasılığı hızlı oku",
    eyebrow: "aiXp Tahmin",
    body: "aiXp; form, puan, istatistik ve akış sinyallerini tek bakışta yorumlanabilir bir tahmin deneyimine çevirir.",
    points: ["1-X-2 olasılıkları", "Güven seviyesi", "Maç içi sinyal güncellemesi"],
    visual: "aixp",
    icon: BrainCircuit,
    accent: "#8a91ff",
    accentAlt: "#3fe0a0"
  },
  {
    title: "Atmosfer ekranında maçın hikayesini izle",
    eyebrow: "Maç Atmosferi",
    body: "Baskımetre, momentum, olaylar ve istatistikler aynı sahnede birleşir. Maçın yönünü skor dışında da okumaya başlarsın.",
    points: ["Baskımetre momentum", "Olay markerları", "Periyotlu istatistik"],
    visual: "atmosphere",
    icon: Activity,
    accent: "#38bdf8",
    accentAlt: "#facc15"
  },
  {
    title: "Sohbet hep maçın yanında",
    eyebrow: "Canlı Sohbet",
    body: "Aynı maçı izleyenlerle yorumlaş, reaksiyon ver ve maçtan kopmadan konuş. Mobilde input alanı ekranın güvenli alt bölgesine göre konumlanır.",
    points: ["Maça özel oda", "Anlık mesaj akışı", "Mobil uyumlu yazma alanı"],
    visual: "chat",
    icon: MessageCircle,
    accent: "#22c55e",
    accentAlt: "#38bdf8"
  },
  {
    title: "Favorilerini kaydet, kritik anları kaçırma",
    eyebrow: "Kişisel Takip",
    body: "Favori maçlarını ayır, bildirimleri aç ve ScoreXP’i kendi canlı maç merkezine dönüştür.",
    points: ["Favori listesi", "Gol ve kart uyarıları", "Tema ve cihaz uyumu"],
    visual: "personal",
    icon: BellRing,
    accent: "#f97316",
    accentAlt: "#e11d48"
  }
];

export function FirstLaunchOnboarding() {
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const step = onboardingSteps[stepIndex];
  const isLastStep = stepIndex === onboardingSteps.length - 1;
  const StepIcon = step.icon;
  const progressLabel = `${stepIndex + 1} / ${onboardingSteps.length}`;
  const panelStyle = useMemo(
    () =>
      ({
        "--tour-accent": step.accent,
        "--tour-accent-2": step.accentAlt
      }) as CSSProperties,
    [step.accent, step.accentAlt]
  );

  useEffect(() => {
    const forceTour = new URLSearchParams(window.location.search).get("intro") === "1";
    if (forceTour || !hasSeenOnboarding()) {
      const timeout = window.setTimeout(() => setVisible(true), 420);
      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (!visible) return undefined;

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss("escape");
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStepIndex((current) => Math.max(0, current - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, stepIndex]);

  const dismiss = (reason: "complete" | "skip" | "escape") => {
    markOnboardingSeen(reason);
    setVisible(false);
  };

  const goNext = () => {
    if (isLastStep) {
      dismiss("complete");
      return;
    }

    setStepIndex((current) => Math.min(onboardingSteps.length - 1, current + 1));
  };

  if (!visible) return null;

  return (
    <div
      className="firstLaunchOnboarding"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-copy"
      style={panelStyle}
    >
      <div className="onboardingBackdropFx" aria-hidden="true" />
      <section className={`onboardingPanel ${step.visual}`} style={panelStyle}>
        <button className="onboardingClose" type="button" aria-label="Tanıtımı kapat" onClick={() => dismiss("skip")}>
          <X size={17} />
        </button>

        <div className="onboardingProgress" aria-label={progressLabel}>
          {onboardingSteps.map((item, index) => (
            <button
              key={item.visual}
              type="button"
              className={index === stepIndex ? "active" : index < stepIndex ? "complete" : ""}
              aria-label={`${index + 1}. adım: ${item.eyebrow}`}
              aria-current={index === stepIndex ? "step" : undefined}
              onClick={() => setStepIndex(index)}
            />
          ))}
        </div>

        <div className="onboardingCopy">
          <span className="onboardingEyebrow">
            <StepIcon size={16} />
            {step.eyebrow}
          </span>
          <h2 id="onboarding-title">{step.title}</h2>
          <p id="onboarding-copy">{step.body}</p>
          <div className="onboardingPointGrid" aria-label="Kısa özellikler">
            {step.points.map((point) => (
              <span key={point}>
                <CheckCircle2 size={14} />
                {point}
              </span>
            ))}
          </div>
        </div>

        <OnboardingVisual kind={step.visual} />

        <footer className="onboardingActions">
          <span>{progressLabel}</span>
          <div>
            <button className="onboardingGhostButton" type="button" onClick={() => dismiss("skip")}>
              Atla
            </button>
            <button
              className="onboardingBackButton"
              type="button"
              disabled={stepIndex === 0}
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft size={15} />
              Geri
            </button>
            <button className="onboardingPrimaryButton" type="button" onClick={goNext}>
              {isLastStep ? "Başla" : "İleri"}
              {isLastStep ? <Sparkles size={15} /> : <Zap size={15} />}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function OnboardingVisual({ kind }: { kind: OnboardingVisualKind }) {
  if (kind === "live") {
    return (
      <div className="onboardingVisual live" aria-hidden="true">
        <div className="onboardingDevice">
          <div className="onboardingDeviceTop">
            <span />
            <em>Canlı</em>
          </div>
          <div className="onboardingMatchPreview hot">
            <span>İST</span>
            <strong>2 - 1</strong>
            <span>ANK</span>
          </div>
          <div className="onboardingMatchPreview">
            <span>ROM</span>
            <strong>0 - 0</strong>
            <span>NAP</span>
          </div>
          <div className="onboardingPulseRail">
            {Array.from({ length: 18 }, (_, index) => (
              <i key={index} style={{ animationDelay: `${index * 80}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (kind === "aixp") {
    return (
      <div className="onboardingVisual aixp" aria-hidden="true">
        <div className="onboardingAiCore">
          <BrainCircuit size={42} />
          <span />
          <i />
        </div>
        <div className="onboardingAiBars">
          <b style={{ width: "58%" }}>1 58%</b>
          <b style={{ width: "24%" }}>X 24%</b>
          <b style={{ width: "39%" }}>2 39%</b>
        </div>
      </div>
    );
  }

  if (kind === "atmosphere") {
    return (
      <div className="onboardingVisual atmosphere" aria-hidden="true">
        <div className="onboardingPressureCard">
          <div className="onboardingPressureTitle">
            <span>Baskımetre</span>
            <strong>Ev %61 · Dep %39</strong>
          </div>
          <div className="onboardingPressureBars">
            {Array.from({ length: 26 }, (_, index) => (
              <i key={index} style={{ height: `${32 + ((index * 17) % 42)}%`, animationDelay: `${index * 42}ms` }} />
            ))}
          </div>
          <div className="onboardingEventDots">
            <span className="goal">⚽</span>
            <span className="corner">⚑</span>
            <span className="card" />
          </div>
        </div>
      </div>
    );
  }

  if (kind === "chat") {
    return (
      <div className="onboardingVisual chat" aria-hidden="true">
        <div className="onboardingChatPhone">
          <div className="onboardingChatBubble one">Gol geliyor...</div>
          <div className="onboardingChatBubble two">aiXp de baskı görüyor</div>
          <div className="onboardingChatBubble three">Korner tehlikeli</div>
          <div className="onboardingComposer">
            <span>Mesaj yaz</span>
            <Send size={14} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="onboardingVisual personal" aria-hidden="true">
      <div className="onboardingPersonalGrid">
        <span>
          <Star size={24} />
          Favoriler
        </span>
        <span>
          <BellRing size={24} />
          Bildirim
        </span>
        <span>
          <Sparkles size={24} />
          Tema
        </span>
      </div>
    </div>
  );
}

function hasSeenOnboarding() {
  try {
    return window.localStorage.getItem(onboardingStorageKey) === "1";
  } catch {
    try {
      return window.sessionStorage.getItem(onboardingStorageKey) === "1";
    } catch {
      return false;
    }
  }
}

function markOnboardingSeen(reason: string) {
  const value = JSON.stringify({ seen: true, reason, at: new Date().toISOString() });
  try {
    window.localStorage.setItem(onboardingStorageKey, "1");
    window.localStorage.setItem(`${onboardingStorageKey}:meta`, value);
    return;
  } catch {
    try {
      window.sessionStorage.setItem(onboardingStorageKey, "1");
      window.sessionStorage.setItem(`${onboardingStorageKey}:meta`, value);
    } catch {
      // Storage may be unavailable. The dialog will remain a best-effort first-run hint.
    }
  }
}
