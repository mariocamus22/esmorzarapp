import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  readStoredTheme,
  systemTheme,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from '../lib/themeStorage'
import { ThemeContext } from './theme-context'

function applyThemeToDocument(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#1f1e1b' : '#f5f3ee')
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme() ?? systemTheme())

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
    }),
    [theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
