import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { adminSearchUsers, type AdminUserSearchRow } from '../lib/adminUsersApi'
import { formatSupabaseError } from '../lib/errors'
import { hasSupabaseConfig } from '../lib/env'

const SEARCH_DEBOUNCE_MS = 280

/**
 * Barra fija solo para la cuenta de soporte: buscar usuario y ver la app con sus datos (solo lectura).
 */
export function AdminImpersonationBar() {
  const titleId = useId()
  const {
    isSupportAdmin,
    isImpersonating,
    impersonatedEmail,
    setImpersonation,
    user,
  } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [rows, setRows] = useState<AdminUserSearchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open || !isSupportAdmin || !hasSupabaseConfig()) {
      setRows([])
      setError(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    void adminSearchUsers(debounced)
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((e) => {
        if (!cancelled) setError(formatSupabaseError(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, isSupportAdmin, debounced])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current
      if (!el?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = useCallback(
    (r: AdminUserSearchRow) => {
      if (user?.id && r.id === user.id) {
        setImpersonation(null)
      } else {
        setImpersonation({ id: r.id, email: r.email })
      }
      setOpen(false)
      setQuery('')
    },
    [setImpersonation, user?.id],
  )

  if (!isSupportAdmin) return null

  return (
    <div className="admin-impersonation-root" ref={rootRef}>
      {isImpersonating && impersonatedEmail && (
        <div className="admin-impersonation-active" role="status">
          <span className="admin-impersonation-active-label">Viendo como</span>
          <span className="admin-impersonation-active-email">{impersonatedEmail}</span>
          <button type="button" className="admin-impersonation-exit" onClick={() => setImpersonation(null)}>
            Volver a mi cuenta
          </button>
        </div>
      )}
      <div className="admin-impersonation-controls">
        <button
          type="button"
          className="admin-impersonation-toggle"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? titleId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {isImpersonating ? 'Cambiar usuario…' : 'Ver como otro usuario…'}
        </button>
        {open && (
          <div className="admin-impersonation-panel" role="region" aria-labelledby={titleId}>
            <p id={titleId} className="admin-impersonation-panel-title">
              Buscar por correo o nombre
            </p>
            <input
              type="search"
              className="admin-impersonation-input"
              placeholder="p. ej. ana@gmail o Luis"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {error && (
              <p className="admin-impersonation-error" role="alert">
                {error}
              </p>
            )}
            {loading && <p className="admin-impersonation-muted">Buscando…</p>}
            {!loading && !error && rows.length === 0 && (
              <p className="admin-impersonation-muted">Sin resultados.</p>
            )}
            {!loading && rows.length > 0 && (
              <ul className="admin-impersonation-list" role="listbox">
                {rows.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="admin-impersonation-row" onClick={() => pick(r)}>
                      <span className="admin-impersonation-row-email">{r.email}</span>
                      {r.display_name && (
                        <span className="admin-impersonation-row-name">{r.display_name}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
