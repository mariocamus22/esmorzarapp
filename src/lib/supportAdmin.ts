import type { User } from '@supabase/supabase-js'

/** Cuenta autorizada para barra de suplantación (debe coincidir con políticas SQL). */
export const SUPPORT_ADMIN_USER_ID = '5f6ff180-33d0-483e-8539-3ea38ced8b0f'
export const SUPPORT_ADMIN_EMAIL = 'mariocamus@hotmail.com'

export function isSupportAdminUser(user: User | null): boolean {
  if (!user?.id || user.id !== SUPPORT_ADMIN_USER_ID) return false
  const em = user.email?.trim().toLowerCase()
  return em === SUPPORT_ADMIN_EMAIL.toLowerCase()
}
