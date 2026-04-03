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
}

export const AuthContext = createContext<AuthState | null>(null)
