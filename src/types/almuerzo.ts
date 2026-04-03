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
  /** Texto agregado (trigger desde almuerzo_gasto_selections o legado) */
  gasto: string | null
  drink: string | null
  bocadillo_name: string | null
  bocadillo_ingredients: string | null
  coffee: string | null
  price: number | null
  review: string | null
  photo_paths: string[]
  created_at: string
  bebida_option_id: string | null
  cafe_option_id: string | null
  /** Opciones de gasto (tabla puente) */
  gasto_opts: MealOptionRef[]
  /** Fila anidada cruda (opcional) */
  gasto_selections?: { option: MealOptionRef | null }[] | null
  bebida_opt?: MealOptionRef | null
  cafe_opt?: MealOptionRef | null
}

/** Datos que enviamos al crear o actualizar (sin id ni created_at) */
export type AlmuerzoInput = {
  bar_name: string
  meal_date: string
  /** UUIDs de meal_options categoría gasto (uno o varios) */
  gasto_option_ids: string[]
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
