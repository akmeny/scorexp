import { Download, MonitorDown, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallTarget = "mobile" | "desktop";

const apkDownloadUrl = (import.meta.env.VITE_APK_DOWNLOAD_URL as string | undefined)?.trim() || "/downloads/scorexp.apk";
const desktopDownloadUrl =
  (import.meta.env.VITE_DESKTOP_DOWNLOAD_URL as string | undefined)?.trim() || "/downloads/scorexp-desktop.zip";

export function InstallPrompt() {
  const [target, setTarget] = useState<InstallTarget | null>(null);

  useEffect(() => {
    setTarget(isMobileBrowser() ? "mobile" : "desktop");
  }, []);

  if (!target) return null;

  const mobile = target === "mobile";
  const href = mobile ? apkDownloadUrl : desktopDownloadUrl;

  const dismiss = () => {
    setTarget(null);
  };

  return (
    <aside className="installPrompt" aria-label={mobile ? "APK indirme onerisi" : "Desktop uygulama onerisi"}>
      <div className="installPromptIcon">{mobile ? <Smartphone size={18} /> : <MonitorDown size={18} />}</div>
      <div className="installPromptText">
        <strong>{mobile ? "ScoreXP APK" : "ScoreXP Desktop"}</strong>
        <span>{mobile ? "Mobil uygulamayi indir" : "Desktop uygulamasini indir"}</span>
      </div>
      <a className="installDownloadButton" href={href} download onClick={dismiss}>
        <Download size={14} />
        <span>Indir</span>
      </a>
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
