import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchProfile } from '../lib/almuerzosApi'
import { setEffectiveUserIdForReads } from '../lib/effectiveUserStore'
import { supabase } from '../lib/supabaseClient'
import { isSupportAdminUser } from '../lib/supportAdmin'
import type { UserProfile } from '../types/almuerzo'
import { AuthContext, type AuthState } from './auth-context'

const IMPERSONATE_STORAGE_KEY = 'esmorzar_impersonate_v1'

type Impersonation = { id: string; email: string }

function readStoredImpersonation(): Impersonation | null {
  try {
    const raw = sessionStorage.getItem(IMPERSONATE_STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { id?: unknown; email?: unknown }
    if (typeof o.id === 'string' && typeof o.email === 'string' && o.id && o.email) {
      return { id: o.id, email: o.email }
    }
  } catch {
    /* ignore */
  }
  return null
}

function impersonationForSession(session: Session | null): Impersonation | null {
  const u = session?.user
  if (!u || !isSupportAdminUser(u)) {
    try {
      sessionStorage.removeItem(IMPERSONATE_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    return null
  }
  return readStoredImpersonation()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthState['session']>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [impersonation, setImpersonationState] = useState<Impersonation | null>(null)

  const user = session?.user ?? null
  const isSupportAdmin = isSupportAdminUser(user)
  const effectiveUserId =
    user && isSupportAdmin && impersonation ? impersonation.id : (user?.id ?? null)

  useLayoutEffect(() => {
    setEffectiveUserIdForReads(effectiveUserId)
  }, [effectiveUserId])

  const setImpersonation = useCallback((target: Impersonation | null) => {
    setImpersonationState(target)
    try {
      if (target) {
        sessionStorage.setItem(IMPERSONATE_STORAGE_KEY, JSON.stringify(target))
      } else {
        sessionStorage.removeItem(IMPERSONATE_STORAGE_KEY)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const uid = effectiveUserId
    if (!uid) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    try {
      const p = await fetchProfile(uid)
      setProfile(p)
    } finally {
      setProfileLoading(false)
    }
  }, [effectiveUserId])

  useEffect(() => {
    let mounted = true

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return
      setImpersonationState(impersonationForSession(s))
      setSession(s)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setImpersonationState(impersonationForSession(s))
      setSession(s)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!effectiveUserId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }

    let cancelled = false

    void (async () => {
      setProfileLoading(true)
      try {
        const p = await fetchProfile(effectiveUserId)
        if (!cancelled) setProfile(p)
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    })()

    const channel = supabase
      .channel(`profile-realtime-${effectiveUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${effectiveUserId}`,
        },
        () => {
          void fetchProfile(effectiveUserId).then((p) => {
            if (!cancelled) setProfile(p)
          })
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [effectiveUserId])

  const isImpersonating = Boolean(isSupportAdmin && impersonation && user && impersonation.id !== user.id)

  const greetingHint = useMemo(() => {
    if (!isImpersonating || !impersonation) return null
    const dn = profile?.display_name?.trim()
    if (dn) return dn.split(/\s+/)[0] || dn
    const local = impersonation.email.split('@')[0]?.trim()
    return local || 'usuario'
  }, [isImpersonating, impersonation, profile?.display_name])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user,
      loading,
      profile,
      profileLoading,
      refreshProfile,
      isSupportAdmin,
      isImpersonating,
      impersonatedUserId: isImpersonating ? impersonation?.id ?? null : null,
      impersonatedEmail: isImpersonating ? impersonation?.email ?? null : null,
      effectiveUserId,
      setImpersonation,
      greetingHint,
      signOut: async () => {
        try {
          sessionStorage.removeItem(IMPERSONATE_STORAGE_KEY)
        } catch {
          /* ignore */
        }
        setImpersonationState(null)
        await supabase.auth.signOut()
        setProfile(null)
      },
    }),
    [
      session,
      user,
      loading,
      profile,
      profileLoading,
      refreshProfile,
      isSupportAdmin,
      isImpersonating,
      impersonation,
      effectiveUserId,
      setImpersonation,
      greetingHint,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
