import { createPortal } from 'react-dom'

/**
 * Overlay ligero mientras se descarga el chunk de la splash con Lottie (evita pantalla vacía).
 */
export function AlmuerzoSaveSplashFallback() {
  return createPortal(
    <div
      className="almuerzo-save-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-relevant="text"
    >
      <div className="almuerzo-save-splash__bg" aria-hidden />
      <div className="almuerzo-save-splash__inner">
        <div className="almuerzo-save-splash__lazy-fallback-stage" aria-hidden>
          <span className="spinner" />
        </div>
        <h2 className="almuerzo-save-splash__title">Guardando tu almuerzo...</h2>
        <p className="almuerzo-save-splash__msg almuerzo-save-splash__msg--static">Un moment…</p>
      </div>
    </div>,
    document.body,
  )
}
