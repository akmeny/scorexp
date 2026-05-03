import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

installMobileInteractionGuards();

function installMobileInteractionGuards() {
  if (typeof window === "undefined") return;

  const isMobileInput = () => window.matchMedia("(pointer: coarse), (max-width: 760px)").matches;
  let touchStartY = 0;

  document.addEventListener("contextmenu", (event) => {
    if (isMobileInput()) event.preventDefault();
  });

  document.addEventListener(
    "touchstart",
    (event) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      if (!isMobileInput()) return;

      const touchY = event.touches[0]?.clientY ?? touchStartY;
      const deltaY = touchY - touchStartY;
      if (Math.abs(deltaY) < 2) return;

      if (isMatchRouteScroll(event.target)) return;
      if (canScrollableTargetMove(event.target, deltaY)) return;

      const pullingDownAtTop = window.scrollY <= 0 && deltaY > 0;
      if (pullingDownAtTop) event.preventDefault();
    },
    { passive: false }
  );
}

function isMatchRouteScroll(target: EventTarget | null) {
  if (document.documentElement.classList.contains("scorexpRoutePage") || document.body.classList.contains("scorexpRoutePage")) {
    return true;
  }

  if (!(target instanceof Element)) return false;

  return Boolean(target.closest(".routeMatchPage, .matchDetailPane, .matchAtmosphereOverlay, .matchAtmosphereShell, .atmosphereScroll"));
}

function canScrollableTargetMove(target: EventTarget | null, deltaY: number) {
  if (!(target instanceof Element)) return false;

  for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
    if (!(element instanceof HTMLElement)) continue;

    const overflowY = window.getComputedStyle(element).overflowY;
    if (!["auto", "scroll", "overlay"].includes(overflowY)) continue;

    const maxScrollTop = element.scrollHeight - element.clientHeight;
    if (maxScrollTop <= 1) continue;

    const scrollingTowardTop = deltaY > 0;
    if (scrollingTowardTop && element.scrollTop > 0) return true;
    if (!scrollingTowardTop && element.scrollTop < maxScrollTop - 1) return true;
  }

  return false;
}
