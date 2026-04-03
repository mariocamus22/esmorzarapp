import { supabase } from './supabaseClient'
import type {
  Almuerzo,
  AlmuerzoInput,
  MealOptionRow,
  UserProfile,
} from '../types/almuerzo'

/** Máximo de fotos por almuerzo (producto) */
export const MAX_FOTOS_ALMUERZO = 5

/** Nombre del bucket en Supabase Storage (debe coincidir con el SQL) */
export const BUCKET_FOTOS = 'almuerzo-fotos'

const TABLE = 'almuerzos'

/** Select PostgREST: FKs nombradas en 003_options_levels_profiles.sql */
const ALMUERZO_SELECT = `
  *,
  gasto_opt:meal_options!almuerzos_gasto_option_id_fkey ( id, label ),
  bebida_opt:meal_options!almuerzos_bebida_option_id_fkey ( id, label ),
  cafe_opt:meal_options!almuerzos_cafe_option_id_fkey ( id, label )
`

async function getUserIdOrThrow(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('Debes iniciar sesión para continuar.')
  return user.id
}

function parseMealOptionRef(v: unknown): { id: string; label: string } | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (o.id == null || o.label == null) return null
  return { id: String(o.id), label: String(o.label) }
}

/**
 * Nombre único para cada foto. Evita `crypto.randomUUID()` directo: en algunos móviles
 * (HTTP o navegadores antiguos) esa función no existe y falla al guardar.
 */
function uniqueFileId(): string {
  const c = globalThis.crypto
  if (c?.randomUUID) {
    return c.randomUUID()
  }
  if (c?.getRandomValues) {
    const b = new Uint8Array(16)
    c.getRandomValues(b)
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

function rowToAlmuerzo(row: Record<string, unknown>): Almuerzo {
  return {
    id: String(row.id),
    user_id: row.user_id != null ? String(row.user_id) : '',
    bar_name: String(row.bar_name),
    meal_date: String(row.meal_date),
    gasto: row.gasto != null ? String(row.gasto) : null,
    drink: row.drink != null ? String(row.drink) : null,
    bocadillo_name: row.bocadillo_name != null ? String(row.bocadillo_name) : null,
    bocadillo_ingredients:
      row.bocadillo_ingredients != null ? String(row.bocadillo_ingredients) : null,
    coffee: row.coffee != null ? String(row.coffee) : null,
    price: row.price != null ? Number(row.price) : null,
    review: row.review != null ? String(row.review) : null,
    photo_paths: Array.isArray(row.photo_paths) ? (row.photo_paths as string[]) : [],
    created_at: String(row.created_at),
    gasto_option_id: row.gasto_option_id != null ? String(row.gasto_option_id) : null,
    bebida_option_id: row.bebida_option_id != null ? String(row.bebida_option_id) : null,
    cafe_option_id: row.cafe_option_id != null ? String(row.cafe_option_id) : null,
    gasto_opt: parseMealOptionRef(row.gasto_opt),
    bebida_opt: parseMealOptionRef(row.bebida_opt),
    cafe_opt: parseMealOptionRef(row.cafe_opt),
  }
}

function rowToProfile(row: Record<string, unknown>): UserProfile {
  const levelRaw = row.level ?? row.levels
  let level: UserProfile['level'] = null
  if (levelRaw && typeof levelRaw === 'object') {
    const l = levelRaw as Record<string, unknown>
    if (l.id != null && l.code != null && l.label != null && l.min_meals != null) {
      level = {
        id: Number(l.id),
        code: String(l.code),
        label: String(l.label),
        min_meals: Number(l.min_meals),
      }
    }
  }
  return {
    id: String(row.id),
    display_name: row.display_name != null ? String(row.display_name) : null,
    total_meals: Number(row.total_meals ?? 0),
    level_id: Number(row.level_id),
    updated_at: String(row.updated_at),
    level,
  }
}

/** URL pública para mostrar una imagen del bucket */
export function getFotoPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(storagePath)
  return data.publicUrl
}

/** Opciones activas de menú, agrupables por `meal_option_categories.code` en el cliente */
export async function listAllMealOptions(): Promise<MealOptionRow[]> {
  const { data, error } = await supabase
    .from('meal_options')
    .select('id, category_id, label, sort_order, is_active, meal_option_categories ( code )')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => {
    const rec = r as Record<string, unknown>
    const cat = rec.meal_option_categories as Record<string, unknown> | null | undefined
    return {
      id: String(rec.id),
      category_id: Number(rec.category_id),
      label: String(rec.label),
      sort_order: Number(rec.sort_order ?? 0),
      is_active: Boolean(rec.is_active),
      meal_option_categories: cat?.code != null ? { code: String(cat.code) } : null,
    }
  })
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, total_meals, level_id, updated_at, level:levels ( id, code, label, min_meals )')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return rowToProfile(data as Record<string, unknown>)
}

export async function listAlmuerzos(): Promise<Almuerzo[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(ALMUERZO_SELECT)
    .order('meal_date', { ascending: false })

  if (error) throw error
  return (data ?? []).map((r) => rowToAlmuerzo(r as Record<string, unknown>))
}

export async function getAlmuerzo(id: string): Promise<Almuerzo | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(ALMUERZO_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return rowToAlmuerzo(data as Record<string, unknown>)
}

async function uploadFotos(userId: string, almuerzoId: string, files: File[]): Promise<string[]> {
  const paths: string[] = []
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safe = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
    const path = `${userId}/${almuerzoId}/${uniqueFileId()}.${safe}`
    const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw error
    paths.push(path)
  }
  return paths
}

async function deleteFotosFromStorage(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET_FOTOS).remove(paths)
  if (error) throw error
}

function uuidOrNull(s: string | null): string | null {
  if (s == null) return null
  const t = s.trim()
  return t === '' ? null : t
}

export async function createAlmuerzo(
  input: AlmuerzoInput,
  newFiles: File[],
): Promise<Almuerzo> {
  if (newFiles.length > MAX_FOTOS_ALMUERZO) {
    throw new Error(`Máximo ${MAX_FOTOS_ALMUERZO} fotos`)
  }

  const userId = await getUserIdOrThrow()

  const payload = {
    user_id: userId,
    bar_name: input.bar_name,
    meal_date: input.meal_date,
    gasto_option_id: uuidOrNull(input.gasto_option_id),
    bebida_option_id: uuidOrNull(input.bebida_option_id),
    cafe_option_id: uuidOrNull(input.cafe_option_id),
    bocadillo_name: emptyToNull(input.bocadillo_name),
    bocadillo_ingredients: emptyToNull(input.bocadillo_ingredients),
    price: input.price,
    review: emptyToNull(input.review),
    photo_paths: [] as string[],
  }

  const { data: inserted, error: insErr } = await supabase
    .from(TABLE)
    .insert(payload)
    .select(ALMUERZO_SELECT)
    .single()

  if (insErr) throw insErr
  const row = inserted as Record<string, unknown>
  const id = String(row.id)

  if (newFiles.length === 0) {
    return rowToAlmuerzo(row)
  }

  try {
    const paths = await uploadFotos(userId, id, newFiles)
    const { data: updated, error: upErr } = await supabase
      .from(TABLE)
      .update({ photo_paths: paths })
      .eq('id', id)
      .select(ALMUERZO_SELECT)
      .single()

    if (upErr) throw upErr
    return rowToAlmuerzo(updated as Record<string, unknown>)
  } catch (e) {
    await supabase.from(TABLE).delete().eq('id', id)
    throw e
  }
}

export async function updateAlmuerzo(
  id: string,
  input: AlmuerzoInput,
  /** Rutas que se mantienen (las que el usuario no ha quitado) */
  keepPaths: string[],
  newFiles: File[],
): Promise<Almuerzo> {
  await getUserIdOrThrow()

  const existing = await getAlmuerzo(id)
  if (!existing) throw new Error('Almuerzo no encontrado')

  const removed = existing.photo_paths.filter((p) => !keepPaths.includes(p))
  if (removed.length > 0) {
    await deleteFotosFromStorage(removed)
  }

  if (keepPaths.length + newFiles.length > MAX_FOTOS_ALMUERZO) {
    throw new Error(`Máximo ${MAX_FOTOS_ALMUERZO} fotos en total`)
  }

  const userId = await getUserIdOrThrow()
  const uploaded = newFiles.length > 0 ? await uploadFotos(userId, id, newFiles) : []
  const photo_paths = [...keepPaths, ...uploaded]

  const payload = {
    bar_name: input.bar_name,
    meal_date: input.meal_date,
    gasto_option_id: uuidOrNull(input.gasto_option_id),
    bebida_option_id: uuidOrNull(input.bebida_option_id),
    cafe_option_id: uuidOrNull(input.cafe_option_id),
    bocadillo_name: emptyToNull(input.bocadillo_name),
    bocadillo_ingredients: emptyToNull(input.bocadillo_ingredients),
    price: input.price,
    review: emptyToNull(input.review),
    photo_paths,
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq('id', id)
    .select(ALMUERZO_SELECT)
    .single()

  if (error) throw error
  return rowToAlmuerzo(data as Record<string, unknown>)
}

export async function deleteAlmuerzo(id: string): Promise<void> {
  await getUserIdOrThrow()

  const existing = await getAlmuerzo(id)
  if (!existing) return
  if (existing.photo_paths.length > 0) {
    await deleteFotosFromStorage(existing.photo_paths)
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

function emptyToNull(s: string): string | null {
  const t = s.trim()
  return t === '' ? null : t
}
