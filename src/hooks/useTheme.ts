import { useContext } from 'react'
import { ThemeContext } from '../contexts/theme-context'

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider')
  }
  return ctx
}
