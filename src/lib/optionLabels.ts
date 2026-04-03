import type { MealOptionRow } from '../types/almuerzo'

/**
 * Quita pictogramas al inicio (incl. secuencias ZWJ / FE0F) hasta el primer texto “normal”.
 * Ej.: "🍺 Cerveza" → "Cerveza", "🍷🫧 Vino con gaseosa" → "Vino con gaseosa".
 */
export function stripLeadingEmojisFromLabel(label: string): string {
  let s = label.trim()
  if (s === '') return label
  const chunk =
    /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*\s*)+/u
  for (let i = 0; i < 12; i++) {
    const next = s.replace(chunk, '').trimStart()
    if (next === s) break
    s = next
  }
  const out = s.trim()
  return out.length > 0 ? out : label
}

/** Texto en la pantalla de selección de bebida (sin emoji). */
export function beverageSelectLabel(label: string): string {
  return stripLeadingEmojisFromLabel(label)
}

function rowHasLeadingEmoji(r: MealOptionRow): boolean {
  return r.label.trim() !== stripLeadingEmojisFromLabel(r.label)
}

/**
 * Una fila por bebida “lógica”: si hay duplicado con/sin emoji, se prioriza la que lleva emoji en BD.
 */
export function dedupeBebidaOptions(rows: MealOptionRow[]): MealOptionRow[] {
  const byPlain = new Map<string, MealOptionRow>()
  for (const row of rows) {
    const plain = stripLeadingEmojisFromLabel(row.label).toLowerCase().trim()
    const existing = byPlain.get(plain)
    if (!existing) {
      byPlain.set(plain, row)
      continue
    }
    if (rowHasLeadingEmoji(row) && !rowHasLeadingEmoji(existing)) {
      byPlain.set(plain, row)
    } else if (rowHasLeadingEmoji(row) === rowHasLeadingEmoji(existing) && row.sort_order < existing.sort_order) {
      byPlain.set(plain, row)
    }
  }
  return [...byPlain.values()].sort((a, b) => a.sort_order - b.sort_order)
}
