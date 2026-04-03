/** Quan no hi ha adreça de Google Places guardada (esmorzars antics o text lliure). */
export const DEFAULT_BAR_LOCATION_FALLBACK = 'València, València'

/** Línia d’ubicació per a UI: adreça completa de Places o fallback. */
export function barLocationLine(formattedAddress: string | null | undefined): string {
  const t = formattedAddress?.trim()
  return t && t.length > 0 ? t : DEFAULT_BAR_LOCATION_FALLBACK
}
