/**
 * Lleva el scroll al inicio: ventana y contenedores con scroll propios de la app
 * (resumen del formulario, ficha de detalle).
 */
export function scrollAppViewportToTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0

  document.querySelectorAll('.form-step5-body, .detail-scroll').forEach((n) => {
    if (n instanceof HTMLElement) n.scrollTop = 0
  })
}
