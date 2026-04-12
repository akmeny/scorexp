"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  defaultTheme,
  normalizeTheme,
  type ThemeMode,
} from "@/lib/theme";

function readCurrentTheme(): ThemeMode {
  if (typeof document === "undefined") {
    return defaultTheme;
  }

  return normalizeTheme(document.documentElement.dataset.theme);
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeMode>(defaultTheme);

  useEffect(() => {
    const currentTheme = readCurrentTheme();
    setTheme(currentTheme);
    applyTheme(currentTheme);
  }, []);

  const setThemeMode = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <div
      className="theme-switcher"
      role="group"
      aria-label="Color theme"
      suppressHydrationWarning
    >
      <span className="theme-switcher-kicker">Theme</span>
      <div className="theme-switcher-group">
        <button
          type="button"
          className={`theme-switcher-button ${
            theme === "dark" ? "is-active" : ""
          }`}
          aria-pressed={theme === "dark"}
          onClick={() => setThemeMode("dark")}
        >
          Dark
        </button>
        <button
          type="button"
          className={`theme-switcher-button ${
            theme === "light" ? "is-active" : ""
          }`}
          aria-pressed={theme === "light"}
          onClick={() => setThemeMode("light")}
        >
          Light
        </button>
      </div>
    </div>
  );
}
