import { type Session, type User } from '@supabase/supabase-js'
import { createContext } from 'react'
import type { UserProfile } from '../types/almuerzo'

export type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  profile: UserProfile | null
  profileLoading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  /** Cuenta soporte: barra para ver la app como otro usuario (solo lectura en datos). */
  isSupportAdmin: boolean
  isImpersonating: boolean
  impersonatedUserId: string | null
  impersonatedEmail: string | null
  effectiveUserId: string | null
  setImpersonation: (target: { id: string; email: string } | null) => void
  /** Saludo en cabecera: perfil suplantado o null para usar metadata del `user` sesión. */
  greetingHint: string | null
}

export const AuthContext = createContext<AuthState | null>(null)
