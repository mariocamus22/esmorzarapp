/** Cuando no hay dirección de Google Places guardada (almuerzos antiguos o texto libre). */
export const DEFAULT_BAR_LOCATION_FALLBACK = 'València, València'

/** Línea de ubicación para la UI: dirección completa de Places o texto alternativo. */
export function barLocationLine(formattedAddress: string | null | undefined): string {
  const t = formattedAddress?.trim()
  return t && t.length > 0 ? t : DEFAULT_BAR_LOCATION_FALLBACK
}
