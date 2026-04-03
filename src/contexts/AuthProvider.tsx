import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchProfile } from '../lib/almuerzosApi'
import { supabase } from '../lib/supabaseClient'
import type { UserProfile } from '../types/almuerzo'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthState['session']>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const refreshProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    try {
      const p = await fetchProfile(user.id)
      setProfile(p)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (mounted) {
        setSession(s)
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    let cancelled = false

    void (async () => {
      setProfileLoading(true)
      try {
        const p = await fetchProfile(userId)
        if (!cancelled) setProfile(p)
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()

    const channel = supabase
      .channel(`profile-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => {
          void fetchProfile(userId).then((p) => {
            if (!cancelled) setProfile(p)
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [userId])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      profile,
      profileLoading,
      refreshProfile,
      signOut: async () => {
        await supabase.auth.signOut()
        setProfile(null)
      },
    }),
    [session, loading, profile, profileLoading, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
