export const themeStorageKey = "scorexp-theme";
export const defaultTheme = "dark";

export type ThemeMode = "dark" | "light";

export const themeInitScript = `(() => {
  const storageKey = "${themeStorageKey}";
  const fallbackTheme = "${defaultTheme}";
  const root = document.documentElement;

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : fallbackTheme;

    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch {
    root.dataset.theme = fallbackTheme;
    root.style.colorScheme = fallbackTheme;
  }
})();`;

export function normalizeTheme(value: string | null | undefined): ThemeMode {
  return value === "light" ? "light" : "dark";
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Ignore storage failures in private browsing modes.
  }
}
