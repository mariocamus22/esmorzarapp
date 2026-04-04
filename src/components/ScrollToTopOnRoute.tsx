import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { scrollAppViewportToTop } from '../lib/scrollAppViewport'

/**
 * Tras cada navegación (cambio de ruta), la nueva pantalla empieza desde arriba.
 */
export function ScrollToTopOnRoute() {
  const { pathname, search } = useLocation()

  useLayoutEffect(() => {
    scrollAppViewportToTop()
  }, [pathname, search])

  return null
}
