/**
 * Correos que en local pueden entrar con contraseña tomada de .env (sin OTP ni campo en pantalla).
 * En Supabase, cada usuario debe existir con la misma contraseña que VITE_AUTO_LOGIN_SHARED_PASSWORD.
 */
const AUTO_LOGIN_EMAILS = new Set(['mariocamus22@gmail.com', 'marioesmorzar@gmail.com'])

export function isAutoLoginEmail(email: string): boolean {
  return AUTO_LOGIN_EMAILS.has(email.trim().toLowerCase())
}

/** Contraseña compartida solo en variables de entorno (nunca en el repo). */
export function autoLoginSharedPassword(): string | undefined {
  const p = import.meta.env.VITE_AUTO_LOGIN_SHARED_PASSWORD
  return typeof p === 'string' && p.length > 0 ? p : undefined
}
