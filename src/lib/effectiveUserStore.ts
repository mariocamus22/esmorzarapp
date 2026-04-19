/**
 * ID de usuario usado en lecturas a Supabase (suplantación o sesión real).
 * Lo actualiza AuthProvider en cada render; almuerzosApi lo lee de forma síncrona.
 */
let effectiveUserIdForReads: string | null = null

export function setEffectiveUserIdForReads(id: string | null): void {
  effectiveUserIdForReads = id
}

export function getEffectiveUserIdForReads(): string | null {
  return effectiveUserIdForReads
}
