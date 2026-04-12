"use client";

import { useEffect } from "react";

export function MobileGuard() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(max-width: 860px)");
    const captureOptions = { capture: true } as const;
    const gestureOptions = { passive: false } as const;

    const preventContextMenu = (event: Event) => {
      event.preventDefault();
    };

    const preventGesture = (event: Event) => {
      event.preventDefault();
    };

    const preventZoomKeys = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "+" || key === "-" || key === "=" || key === "0") {
        event.preventDefault();
      }
    };

    const enable = () => {
      document.addEventListener("contextmenu", preventContextMenu, captureOptions);
      document.addEventListener("gesturestart", preventGesture as EventListener, gestureOptions);
      document.addEventListener("gesturechange", preventGesture as EventListener, gestureOptions);
      document.addEventListener("gestureend", preventGesture as EventListener, gestureOptions);
      document.addEventListener("keydown", preventZoomKeys, gestureOptions);
    };

    const disable = () => {
      document.removeEventListener("contextmenu", preventContextMenu, captureOptions);
      document.removeEventListener("gesturestart", preventGesture as EventListener);
      document.removeEventListener("gesturechange", preventGesture as EventListener);
      document.removeEventListener("gestureend", preventGesture as EventListener);
      document.removeEventListener("keydown", preventZoomKeys);
    };

    const onChange = () => {
      if (media.matches) {
        enable();
      } else {
        disable();
      }
    };

    onChange();

    media.addEventListener("change", onChange);

    return () => {
      media.removeEventListener("change", onChange);
      disable();
    };
  }, []);

  return null;
}
