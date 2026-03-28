import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'
import { formatSupabaseError } from '../lib/errors'
import { listAlmuerzos } from '../lib/almuerzosApi'
import { hasSupabaseConfig } from '../lib/env'
import type { Almuerzo } from '../types/almuerzo'

const RECENT_PREVIEW = 5
const FEEDBACK_MAIL = 'mailto:?subject=' + encodeURIComponent('Esmorzapp — comentari')

function formatFecha(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function resumen(a: Almuerzo): string {
  const b = a.bocadillo_name?.trim()
  if (b) return b
  const r = a.review?.trim()
  if (r) return r.length > 80 ? `${r.slice(0, 80)}…` : r
  return 'Sense descripció'
}

function firstName(user: User | null): string {
  if (!user) return 'amic'
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const full =
    typeof meta?.full_name === 'string'
      ? meta.full_name
      : typeof meta?.name === 'string'
        ? meta.name
        : null
  if (full?.trim()) {
    const part = full.trim().split(/\s+/)[0]
    return part || 'amic'
  }
  const email = user.email?.split('@')[0]
  return email?.trim() || 'amic'
}

/** Nivell segons el nombre total d'esmorzars registrats */
function nivellLabel(total: number): string {
  if (total === 0) return 'Principiante'
  if (total < 5) return 'Novell'
  if (total < 10) return 'Explorador'
  if (total < 20) return 'Aficionat'
  if (total < 35) return 'Expert'
  return 'Llegenda'
}

function IconCroissant() {
  return (
    <svg
      className="home-logo-svg"
      width={44}
      height={44}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <g fill="currentColor" transform="translate(12 12) rotate(-22)">
        <ellipse cx="-5.2" cy="0" rx="3.6" ry="5.2" />
        <ellipse cx="0" cy="0" rx="4.2" ry="5.6" />
        <ellipse cx="5.2" cy="0" rx="3.6" ry="5.2" />
      </g>
    </svg>
  )
}

function IconBowlEmpty() {
  return (
    <svg width={56} height={56} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M14 30c0 16 10.5 24 18 24s18-8 18-24H14z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M46 22l10 12M56 22L46 34"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSupport() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3C7.5 3 4 6.2 4 10v3H6a2 2 0 012 2v1a2 2 0 002 2h4a2 2 0 002-2v-1a2 2 0 012-2h2v-3c0-3.8-3.5-7-8-7z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 19v1a3 3 0 003 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 8v2M12 12h.01"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg className="home-recent-chevron" width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Pantalla principal: resum, estadístiques i últims esmorzars (buit o amb dades).
 */
export function HomeList() {
  const { user, signOut } = useAuth()
  const [items, setItems] = useState<Almuerzo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllRecents, setShowAllRecents] = useState(false)

  useEffect(() => {
    if (!hasSupabaseConfig() || !user?.id) {
      setLoading(false)
      setError(null)
      setItems([])
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const rows = await listAlmuerzos()
        if (!cancelled) {
          setItems(rows)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(formatSupabaseError(e))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (items.length <= RECENT_PREVIEW) setShowAllRecents(false)
  }, [items.length])

  const sinConfig = !hasSupabaseConfig()
  const nom = firstName(user)
  const total = items.length
  const uniqueBars = useMemo(
    () => new Set(items.map((i) => i.bar_name.trim().toLowerCase())).size,
    [items],
  )
  const nivell = useMemo(() => nivellLabel(total), [total])

  const displayedRecents = useMemo(() => {
    if (showAllRecents || items.length <= RECENT_PREVIEW) return items
    return items.slice(0, RECENT_PREVIEW)
  }, [items, showAllRecents])

  const showVeureTots = !loading && items.length > RECENT_PREVIEW

  const statEsmorzars = loading ? '—' : String(total)
  const statBars = loading ? '—' : String(uniqueBars)
  const statNivell = loading ? '…' : nivell

  return (
    <main className="page home-page">
      <header className="home-top-bar">
        <div className="home-brand">
          <IconCroissant />
          <span className="home-brand-name">Esmorzapp</span>
        </div>
        <a
          className="home-support-btn"
          href={FEEDBACK_MAIL}
          aria-label="Ajuda o comentaris"
          title="Ajuda o comentaris"
        >
          <IconSupport />
        </a>
      </header>

      <h1 className="home-greeting">A on toca esmorzar hui, {nom}?</h1>

      <div className="home-stats-row" aria-live="polite">
        <div className="home-stat-card">
          <span className={`home-stat-value ${loading ? 'home-stat-value--muted' : ''}`}>
            {statEsmorzars}
          </span>
          <span className="home-stat-label">Esmorzars</span>
        </div>
        <div className="home-stat-card">
          <span className={`home-stat-value ${loading ? 'home-stat-value--muted' : ''}`}>
            {statBars}
          </span>
          <span className="home-stat-label">Bars</span>
        </div>
        <div className="home-stat-card">
          <span
            className={`home-stat-value ${loading ? 'home-stat-value--muted' : ''}`}
            style={{ fontSize: statNivell.length > 11 ? '0.95rem' : undefined }}
          >
            {statNivell}
          </span>
          <span className="home-stat-label">Nivell</span>
        </div>
      </div>

      <p className="home-stats-hint">Puja els teus esmorzars per pujar de nivell.</p>

      {sinConfig && (
        <p className="banner banner-warn" role="status">
          Configura Supabase: copia <code>.env.example</code> a <code>.env</code> i enganxa la URL i la
          clau anon del panell.
        </p>
      )}

      {error && (
        <p className="banner banner-error" role="alert">
          {error}
        </p>
      )}

      <Link to="/nuevo" className="btn btn-primary home-cta">
        <span className="home-cta-icon" aria-hidden>
          +
        </span>
        Nou esmorzar
      </Link>

      <section className="home-recent" aria-labelledby="home-recent-heading">
        <div className="home-recent-head">
          <h2 id="home-recent-heading" className="home-recent-title">
            Últims esmorzars
          </h2>
          {showVeureTots && (
            <button
              type="button"
              className="home-link-all"
              onClick={() => setShowAllRecents((v) => !v)}
            >
              {showAllRecents ? 'Mostrar menys' : 'Veure tots →'}
            </button>
          )}
        </div>

        {loading && (
          <div className="home-loading-inline" aria-busy="true" aria-live="polite">
            <span className="spinner" aria-hidden />
            <span>Carregant…</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && !sinConfig && (
          <div className="home-empty-card" aria-live="polite">
            <div className="home-empty-icon">
              <IconBowlEmpty />
            </div>
            <p className="home-empty-title">Encara no tens cap esmorzar</p>
            <p className="home-empty-desc">
              Afegeix el teu primer per a començar a fer un seguiment.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <ul className="home-recent-list">
            {displayedRecents.map((a) => (
              <li key={a.id}>
                <Link to={`/almuerzo/${a.id}`} className="home-recent-item">
                  <div className="home-recent-item-body">
                    <span className="home-recent-item-title">{a.bar_name}</span>
                    <span className="home-recent-item-meta">{formatFecha(a.meal_date)}</span>
                    <span className="home-recent-item-snippet">{resumen(a)}</span>
                  </div>
                  <IconChevron />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="home-footer">
        <button type="button" className="home-sign-out" onClick={() => signOut()}>
          Tancar sessió
        </button>
      </footer>
    </main>
  )
}
