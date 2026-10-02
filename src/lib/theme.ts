export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "notes_taker_theme";

/**
 * Runs in <head> before the page paints so a saved light or dark choice never flashes the
 * other theme. "system" leaves data-theme unset and the CSS follows prefers-color-scheme.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyThemePreference(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* The choice still applies for this visit. */
  }
}
