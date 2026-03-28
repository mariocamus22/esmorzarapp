import { createClient } from '@supabase/supabase-js'

/**
 * Cliente de Supabase: URL + clave anon desde .env.
 * Sesión persistente (localStorage) y detección de magic link en la URL.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn(
    '[Esmorzar] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env — copia .env.example y rellénalos.',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
