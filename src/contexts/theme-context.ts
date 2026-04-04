import { createContext } from 'react'
import type { ThemeMode } from '../lib/themeStorage'

export type ThemeContextValue = {
  theme: ThemeMode
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
