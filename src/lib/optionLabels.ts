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

/** Emoji mostrado en la tarjeta de bebida según la etiqueta de `meal_options`. */
export function drinkEmojiForLabel(label: string): string {
  const plain = stripLeadingEmojisFromLabel(label).toLowerCase().trim()

  if (plain.includes('sin bebida')) return '🚫'
  if (plain.includes('vino') && plain.includes('gaseosa')) return '🍷🫧'
  if (plain.includes('cerveza')) return '🍺'
  if (plain.includes('vino')) return '🍷'
  if (plain.includes('refresco')) return '🥤'
  if (plain.includes('agua')) return '💧'
  if (plain.includes('zumo') || plain.includes('bebida natural')) return '🧃'

  return '🥤'
}

/** Texto del chip de café (sin emoji inicial). */
export function coffeeSelectLabel(label: string): string {
  return stripLeadingEmojisFromLabel(label)
}

const COFFEE_NORM = /[\u0300-\u036f]/g

function coffeePlainNormalized(label: string): string {
  return stripLeadingEmojisFromLabel(label)
    .toLowerCase()
    .normalize('NFD')
    .replace(COFFEE_NORM, '')
    .trim()
}

/**
 * Emoji del chip de café según la etiqueta de `meal_options` (resumen / ficha).
 * Infusión → 🍵, Sin café → ❌, resto de opciones de café → ☕️.
 */
export function coffeeEmojiForLabel(label: string): string {
  const n = coffeePlainNormalized(label)
  if (n.includes('sin cafe')) return '❌'
  if (n.includes('infusion')) return '🍵'
  return '☕️'
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
