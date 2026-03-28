/** True si hay variables de entorno para conectar a Supabase */
export function hasSupabaseConfig(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL?.length && import.meta.env.VITE_SUPABASE_ANON_KEY?.length,
  )
}

/**
 * Si es true, en /login se puede entrar con email + contraseña (sin enviar OTP por correo).
 * Útil en local y QA para evitar el límite de emails de Supabase Auth.
 * No lo actives en producción pública si no quieres exponer ese flujo.
 */
export function passwordLoginEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_PASSWORD_LOGIN === 'true'
}
