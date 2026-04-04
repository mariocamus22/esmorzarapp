/** Debe coincidir con el script inline en index.html (anti-FOUC). */
export const THEME_STORAGE_KEY = 'esmorzapp-theme'

export type ThemeMode = 'light' | 'dark'

export function readStoredTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return null
}

export function systemTheme(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
