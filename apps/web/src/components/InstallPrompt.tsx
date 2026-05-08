import { Download, MonitorDown, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallTarget = "mobile" | "desktop";
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const desktopDownloadUrl =
  (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as string | undefined)?.trim() || "/downloads/scorexp-desktop.zip";

export function InstallPrompt() {
  const [target, setTarget] = useState<InstallTarget | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const updateTarget = () => {
      setTarget(isInstalledApp() ? null : isMobileBrowser() ? "mobile" : "desktop");
    };

    updateTarget();
    window.addEventListener("appinstalled", updateTarget);
    window.addEventListener("visibilitychange", updateTarget);

    const standaloneQuery = window.matchMedia?.("(display-mode: standalone)");
    if (standaloneQuery?.addEventListener) {
      standaloneQuery.addEventListener("change", updateTarget);
    } else {
      standaloneQuery?.addListener?.(updateTarget);
    }

    return () => {
      window.removeEventListener("appinstalled", updateTarget);
      window.removeEventListener("visibilitychange", updateTarget);
      if (standaloneQuery?.removeEventListener) {
        standaloneQuery.removeEventListener("change", updateTarget);
      } else {
        standaloneQuery?.removeListener?.(updateTarget);
      }
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      if (isInstalledApp()) return;
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!target) return null;

  const mobile = target === "mobile";

  const dismiss = () => {
    setTarget(null);
  };

  const installMobileApp = async () => {
    if (!installPrompt) {
      dismiss();
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    setInstallPrompt(null);
    dismiss();
  };

  return (
    <aside className="installPrompt" aria-label={mobile ? "Mobil uygulama önerisi" : "Desktop uygulama önerisi"}>
      <div className="installPromptIcon">{mobile ? <Smartphone size={18} /> : <MonitorDown size={18} />}</div>
      <div className="installPromptText">
        <strong>{mobile ? "ScoreXP Mobil" : "ScoreXP Desktop"}</strong>
        <span>{mobile ? "Uygulama olarak kur" : "Desktop uygulamasını indir"}</span>
      </div>
      {mobile ? (
        <button className="installDownloadButton" type="button" onClick={installMobileApp}>
          <Download size={14} />
          <span>Kur</span>
        </button>
      ) : (
        <a className="installDownloadButton" href={desktopDownloadUrl} download onClick={dismiss}>
          <Download size={14} />
          <span>İndir</span>
        </a>
      )}
      <button className="installCloseButton" type="button" aria-label="Kapat" onClick={dismiss}>
        <X size={15} />
      </button>
    </aside>
  );
}

function isMobileBrowser() {
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const compactViewport = window.matchMedia?.("(max-width: 760px)").matches ?? false;
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileAgent = /android|iphone|ipad|ipod|mobile/.test(userAgent);
  return mobileAgent || (coarsePointer && compactViewport);
}

function isInstalledApp() {
  const standaloneDisplay = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const fullscreenDisplay = window.matchMedia?.("(display-mode: fullscreen)").matches ?? false;
  const minimalUiDisplay = window.matchMedia?.("(display-mode: minimal-ui)").matches ?? false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const androidTrustedWebActivity = document.referrer.startsWith("android-app://");

  return standaloneDisplay || fullscreenDisplay || minimalUiDisplay || iosStandalone || androidTrustedWebActivity;
}
