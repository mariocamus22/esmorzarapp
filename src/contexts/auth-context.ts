import { type Session, type User } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
