/** Id compartido por el único `<main>` visible en cada ruta (WCAG 2.4.1). */
export const MAIN_CONTENT_ID = 'main-content'

/**
 * Primer enlace enfocable: salta al contenido principal (teclado / lector de pantalla).
 */
export function SkipToMainContent() {
  return (
    <a className="skip-to-main" href={`#${MAIN_CONTENT_ID}`}>
      Saltar al contenido principal
    </a>
  )
}
