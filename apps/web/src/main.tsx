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
      const pullingDownAtTop = window.scrollY <= 0 && touchY > touchStartY;
      if (pullingDownAtTop) event.preventDefault();
    },
    { passive: false }
  );
}
