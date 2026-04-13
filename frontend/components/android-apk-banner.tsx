"use client";

import { useEffect, useState } from "react";

const storageKey = "scorexp-android-apk-banner-dismissed-v1";
const apkUrl = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim() ?? "";

function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /android/i.test(navigator.userAgent);
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(display-mode: standalone)").matches;
}

export function AndroidApkBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!apkUrl || !isAndroidDevice() || isStandaloneMode()) {
      return;
    }

    try {
      if (window.localStorage.getItem(storageKey) === "1") {
        return;
      }
    } catch {
      return;
    }

    setVisible(true);
  }, []);

  if (!visible || !apkUrl) {
    return null;
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore local storage failures and still hide the banner for this session.
    }

    setVisible(false);
  };

  return (
    <section className="banner banner-info apk-banner">
      <div className="apk-banner-copy">
        <p>Android uygulamasi hazir. Uygulamayi yukleyip daha hizli kullanabilirsin.</p>
        <p className="banner-subtext">Bu bildirim ayni cihazda sadece bir kez gosterilir.</p>
      </div>
      <div className="apk-banner-actions">
        <a
          href={apkUrl}
          className="secondary-link apk-banner-link"
          target="_blank"
          rel="noreferrer"
          onClick={dismiss}
        >
          Uygulamayi yukle
        </a>
        <button
          type="button"
          className="secondary-link apk-banner-dismiss"
          onClick={dismiss}
        >
          Kapat
        </button>
      </div>
    </section>
  );
}
