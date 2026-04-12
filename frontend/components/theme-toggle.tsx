"use client";

import { useEffect, useState } from "react";

type ThemeMode = "dark" | "light";

const themeStorageKey = "scorexp-theme";

function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function getInitialTheme(): ThemeMode {
  if (typeof document === "undefined") {
    return "dark";
  }

  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={`theme-toggle is-${theme}`}
      aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
      aria-pressed={theme === "light"}
      title={theme === "dark" ? "Açık tema" : "Koyu tema"}
      onClick={() => {
        setTheme(nextTheme);

        try {
          window.localStorage.setItem(themeStorageKey, nextTheme);
        } catch {
          // Theme persistence is a progressive enhancement.
        }
      }}
    >
      <span className="theme-toggle-icon" aria-hidden="true" />
      <span className="theme-toggle-label">
        {theme === "dark" ? "Açık" : "Koyu"}
      </span>
    </button>
  );
}
