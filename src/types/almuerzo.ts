/**
 * Forma de un almuerzo tal como lo guardamos y leemos en Supabase.
 * Los nombres en inglés/snake_case coinciden con las columnas de la base de datos.
 */
export type MealOptionRef = {
  id: string
  label: string
}

export type Almuerzo = {
  id: string
  /** Propietario (Supabase Auth) */
  user_id: string
  bar_name: string
  meal_date: string
  /** Columnas legadas; se rellenan por trigger desde *_option_id cuando existen */
  gasto: string | null
  drink: string | null
  bocadillo_name: string | null
  bocadillo_ingredients: string | null
  coffee: string | null
  price: number | null
  review: string | null
  photo_paths: string[]
  created_at: string
  gasto_option_id: string | null
  bebida_option_id: string | null
  cafe_option_id: string | null
  /** Etiquetas resueltas (select anidado PostgREST) */
  gasto_opt?: MealOptionRef | null
  bebida_opt?: MealOptionRef | null
  cafe_opt?: MealOptionRef | null
}

/** Datos que enviamos al crear o actualizar (sin id ni created_at) */
export type AlmuerzoInput = {
  bar_name: string
  meal_date: string
  gasto_option_id: string | null
  bebida_option_id: string | null
  cafe_option_id: string | null
  bocadillo_name: string
  bocadillo_ingredients: string
  price: number | null
  review: string
}

export type MealOptionCategoryCode = 'gasto' | 'bebida' | 'cafe'

export type MealOptionRow = {
  id: string
  category_id: number
  label: string
  sort_order: number
  is_active: boolean
  meal_option_categories?: { code: string } | null
}

export type LevelRow = {
  id: number
  code: string
  label: string
  min_meals: number
}

export type UserProfile = {
  id: string
  display_name: string | null
  total_meals: number
  level_id: number
  updated_at: string
  level: LevelRow | null
}
