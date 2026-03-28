/** True si hay variables de entorno para conectar a Supabase */
export function hasSupabaseConfig(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL?.length && import.meta.env.VITE_SUPABASE_ANON_KEY?.length,
  )
}
