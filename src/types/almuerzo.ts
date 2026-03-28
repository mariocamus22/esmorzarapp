/**
 * Forma de un almuerzo tal como lo guardamos y leemos en Supabase.
 * Los nombres en inglés/snake_case coinciden con las columnas de la base de datos.
 */
export type Almuerzo = {
  id: string
  /** Propietario (Supabase Auth) */
  user_id: string
  bar_name: string
  meal_date: string
  gasto: string | null
  drink: string | null
  bocadillo_name: string | null
  bocadillo_ingredients: string | null
  coffee: string | null
  price: number | null
  review: string | null
  photo_paths: string[]
  created_at: string
}

/** Datos que enviamos al crear o actualizar (sin id ni created_at) */
export type AlmuerzoInput = {
  bar_name: string
  meal_date: string
  gasto: string
  drink: string
  bocadillo_name: string
  bocadillo_ingredients: string
  coffee: string
  price: number | null
  review: string
}
