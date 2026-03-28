import { supabase } from './supabaseClient'
import type { Almuerzo, AlmuerzoInput } from '../types/almuerzo'

/** Máximo de fotos por almuerzo (producto) */
export const MAX_FOTOS_ALMUERZO = 5

/** Nombre del bucket en Supabase Storage (debe coincidir con el SQL) */
export const BUCKET_FOTOS = 'almuerzo-fotos'

const TABLE = 'almuerzos'

async function getUserIdOrThrow(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('Debes iniciar sesión para continuar.')
  return user.id
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
  }
}

/** URL pública para mostrar una imagen del bucket */
export function getFotoPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(storagePath)
  return data.publicUrl
}

export async function listAlmuerzos(): Promise<Almuerzo[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('meal_date', { ascending: false })

  if (error) throw error
  return (data ?? []).map((r) => rowToAlmuerzo(r as Record<string, unknown>))
}

export async function getAlmuerzo(id: string): Promise<Almuerzo | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()

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
    gasto: emptyToNull(input.gasto),
    drink: emptyToNull(input.drink),
    bocadillo_name: emptyToNull(input.bocadillo_name),
    bocadillo_ingredients: emptyToNull(input.bocadillo_ingredients),
    coffee: emptyToNull(input.coffee),
    price: input.price,
    review: emptyToNull(input.review),
    photo_paths: [] as string[],
  }

  const { data: inserted, error: insErr } = await supabase
    .from(TABLE)
    .insert(payload)
    .select('*')
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
      .select('*')
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
    gasto: emptyToNull(input.gasto),
    drink: emptyToNull(input.drink),
    bocadillo_name: emptyToNull(input.bocadillo_name),
    bocadillo_ingredients: emptyToNull(input.bocadillo_ingredients),
    coffee: emptyToNull(input.coffee),
    price: input.price,
    review: emptyToNull(input.review),
    photo_paths,
  }

  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select('*').single()

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
