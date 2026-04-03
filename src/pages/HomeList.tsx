import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'
import { formatSupabaseError } from '../lib/errors'
import { getFotoPublicUrl, listAlmuerzos, listLevels } from '../lib/almuerzosApi'
import { barLocationLine } from '../lib/barLocation'
import { hasSupabaseConfig } from '../lib/env'
import type { Almuerzo, LevelRow, UserProfile } from '../types/almuerzo'

const RECENT_PREVIEW = 5

function formatFechaLarga(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Nombre del bocadillo para la zona inferior de la tarjeta del historial (texto completo). */
function nomBocadilloResum(a: Almuerzo): string {
  const n = a.bocadillo_name?.trim()
  if (n) return n
  return 'Sin bocadillo'
}

function firstName(user: User | null): string {
  if (!user) return 'amigo'
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const full =
    typeof meta?.full_name === 'string'
      ? meta.full_name
      : typeof meta?.name === 'string'
        ? meta.name
        : null
  if (full?.trim()) {
    const part = full.trim().split(/\s+/)[0]
    return part || 'amigo'
  }
  const email = user.email?.split('@')[0]
  return email?.trim() || 'amigo'
}

/** Progreso hacia el siguiente nivel según `total_meals` del perfil y la tabla `levels`. */
function nextLevelProgress(
  profile: UserProfile | null,
  levels: LevelRow[],
  levelsReady: boolean,
  profileLoading: boolean,
):
  | { kind: 'loading' }
  | { kind: 'fallback' }
  | { kind: 'next'; remaining: number }
  | { kind: 'max' } {
  if (!levelsReady || (profileLoading && profile == null)) return { kind: 'loading' }
  if (!profile || levels.length === 0) return { kind: 'fallback' }
  const total = profile.total_meals
  const next = levels.find((l) => l.min_meals > total)
  if (!next) return { kind: 'max' }
  return { kind: 'next', remaining: Math.max(0, next.min_meals - total) }
}

function levelHintText(progress: ReturnType<typeof nextLevelProgress>): string {
  if (progress.kind === 'loading') {
    return 'Cargando tu progreso…'
  }
  if (progress.kind === 'fallback') {
    return 'Añade almuerzos para pasar al siguiente nivel.'
  }
  if (progress.kind === 'max') {
    return '¡Has alcanzado el nivel más alto!'
  }
  if (progress.remaining <= 0) {
    return '¡Siguiente nivel desbloqueado!'
  }
  if (progress.remaining === 1) {
    return 'Añade 1 almuerzo más para pasar al siguiente nivel.'
  }
  return `Añade ${progress.remaining} almuerzos más para pasar al siguiente nivel.`
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

/** Burbuja de mensaje + idea: sugiere opiniones y mejoras. */
function IconFeedback() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 10h8M8 14h5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
      <path
        d="M6.5 18.5L5 21l3.2-.9c.9.5 1.9.8 3 .9h4.1c2.5 0 4.5-2 4.5-4.5v-6C20 7.5 18 5.5 15.5 5.5H8.5C6 5.5 4 7.5 4 10v6c0 .9.3 1.7.8 2.4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 3.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3 1-2z"
        fill="currentColor"
        opacity={0.92}
      />
    </svg>
  )
}

type FeedbackModalProps = {
  open: boolean
  onClose: () => void
}

function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const titleId = useId()
  const descId = useId()
  const fieldId = useId()
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (!open) return
    setText('')
    const t = window.setTimeout(() => taRef.current?.focus(), 50)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const send = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) {
      setShake(true)
      window.setTimeout(() => setShake(false), 450)
      taRef.current?.focus()
      return
    }
    const to = (import.meta.env.VITE_FEEDBACK_EMAIL as string | undefined)?.trim()
    const subject = encodeURIComponent('Esmorzapp — Feedback')
    const body = encodeURIComponent(trimmed)
    const href = to
      ? `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`
    window.location.href = href
    onClose()
  }, [text, onClose])

  if (!open) return null

  return (
    <div className="feedback-modal-root" role="presentation">
      <button
        type="button"
        className="feedback-modal-backdrop"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div
        className="feedback-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="feedback-modal-head">
          <div className="feedback-modal-head-text">
            <h2 id={titleId} className="feedback-modal-title">
              Cuéntanos qué mejorarías
            </h2>
            <p id={descId} className="feedback-modal-desc">
              Ideas, fallos que hayas visto o cualquier sugerencia nos ayuda a pulir Esmorzapp.
            </p>
          </div>
          <button type="button" className="feedback-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <label className="feedback-modal-label" htmlFor={fieldId}>
          <span className="feedback-modal-label-text">Tu mensaje</span>
          <textarea
            ref={taRef}
            id={fieldId}
            className={`feedback-modal-textarea ${shake ? 'feedback-modal-textarea--shake' : ''}`}
            rows={5}
            placeholder="Por ejemplo: me gustaría poder filtrar por bar, o el botón X no responde en…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="feedback-modal-actions">
          <button type="button" className="btn btn-ghost feedback-modal-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary feedback-modal-btn-primary" onClick={send}>
            Enviar con el correo
          </button>
        </div>
        <p className="feedback-modal-footnote">
          Se abrirá tu app de correo con el mensaje listo. Si no tienes cuenta configurada, copia el
          texto antes de cerrar.
        </p>
      </div>
    </div>
  )
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconHistoryCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconHistoryBurger({ className }: { className?: string }) {
  return (
    <svg className={className} width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 7h14M5 12h14M5 17h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function HistoryCardAvatar({ photoPath }: { photoPath: string | null }) {
  if (photoPath) {
    return (
      <img
        src={getFotoPublicUrl(photoPath)}
        alt=""
        className="home-history-avatar-img"
        loading="lazy"
      />
    )
  }
  return (
    <div className="home-history-avatar-placeholder" aria-hidden>
      <IconHistoryBurger className="home-history-avatar-placeholder-icon" />
    </div>
  )
}

/**
 * Pantalla principal: resumen, estadísticas y últimos almuerzos.
 */
export function HomeList() {
  const { user, signOut, profile, profileLoading } = useAuth()
  const [items, setItems] = useState<Almuerzo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllRecents, setShowAllRecents] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [levelsReady, setLevelsReady] = useState(false)

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
    if (!hasSupabaseConfig()) {
      setLevels([])
      setLevelsReady(true)
      return
    }
    let cancelled = false
    setLevelsReady(false)
    void listLevels()
      .then((L) => {
        if (!cancelled) setLevels(L)
      })
      .catch(() => {
        if (!cancelled) setLevels([])
      })
      .finally(() => {
        if (!cancelled) setLevelsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (items.length <= RECENT_PREVIEW) setShowAllRecents(false)
  }, [items.length])

  const sinConfig = !hasSupabaseConfig()
  const nom = firstName(user)
  /** Contador de almuerzos: misma fuente que la lista (evita desfase con `profile.total_meals`). */
  const esmorzarCount = items.length
  /** Bares distintos (nombre normalizado): solo sube cuando aparece un bar nuevo en el historial. */
  const uniqueBars = useMemo(
    () => new Set(items.map((i) => i.bar_name.trim().toLowerCase())).size,
    [items],
  )
  const nivell = profile?.level?.label ?? '…'

  const displayedRecents = useMemo(() => {
    if (showAllRecents || items.length <= RECENT_PREVIEW) return items
    return items.slice(0, RECENT_PREVIEW)
  }, [items, showAllRecents])

  const showVeureTots = !loading && items.length > RECENT_PREVIEW

  const statEsmorzars = loading ? '—' : String(esmorzarCount)
  const statBars = loading ? '—' : String(uniqueBars)
  const statNivell = loading || (profileLoading && profile == null) ? '…' : nivell

  const levelProgress = useMemo(
    () => nextLevelProgress(profile, levels, levelsReady, profileLoading),
    [profile, levels, levelsReady, profileLoading],
  )

  const statsHint = useMemo(() => {
    if (sinConfig) {
      return 'Cuando registres almuerzos, aquí verás cuántos faltan para el siguiente nivel.'
    }
    return levelHintText(levelProgress)
  }, [sinConfig, levelProgress])

  return (
    <main className="page home-page">
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      <header className="home-top-bar">
        <div className="home-brand">
          <IconCroissant />
          <span className="home-brand-name">Esmorzapp</span>
        </div>
        <button
          type="button"
          className="home-feedback-btn"
          onClick={() => setFeedbackOpen(true)}
          aria-label="Enviar opiniones o informar de un problema"
          title="Tu opinión nos ayuda a mejorar"
        >
          <IconFeedback />
        </button>
      </header>

      <h1 className="home-greeting">¿Dónde toca almorzar hoy, {nom}?</h1>

      <div className="home-stats-row" aria-live="polite">
        <div className="home-stat-card">
          <div className="home-stat-body">
            <span className={`home-stat-value ${loading ? 'home-stat-value--muted' : ''}`}>
              {statEsmorzars}
            </span>
          </div>
          <span className="home-stat-label">Almuerzos</span>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-body">
            <span className={`home-stat-value ${loading ? 'home-stat-value--muted' : ''}`}>
              {statBars}
            </span>
          </div>
          <span className="home-stat-label">Bares</span>
        </div>
        <div className="home-stat-card">
          <div className="home-stat-body">
            <span
              className={`home-stat-value home-stat-value--level ${loading ? 'home-stat-value--muted' : ''} ${statNivell.length > 11 ? 'home-stat-value--level-sm' : ''}`}
            >
              {statNivell}
            </span>
          </div>
          <span className="home-stat-label">Nivel</span>
        </div>
      </div>

      <p className="home-stats-hint">{statsHint}</p>

      {sinConfig && (
        <p className="banner banner-warn" role="status">
          Configura Supabase: copia <code>.env.example</code> a <code>.env</code> y pega la URL y la clave
          anónima del panel.
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
        Nuevo almuerzo
      </Link>

      <section className="home-recent" aria-labelledby="home-recent-heading">
        <div className="home-recent-head">
          <h2 id="home-recent-heading" className="home-recent-title">
            Últimos almuerzos
          </h2>
          {showVeureTots && (
            <button
              type="button"
              className="home-link-all"
              onClick={() => setShowAllRecents((v) => !v)}
            >
              {showAllRecents ? 'Mostrar menos' : 'Ver todos →'}
            </button>
          )}
        </div>

        {loading && (
          <div className="home-loading-inline" aria-busy="true" aria-live="polite">
            <span className="spinner" aria-hidden />
            <span>Cargando…</span>
          </div>
        )}

        {!loading && !error && items.length === 0 && !sinConfig && (
          <div className="home-empty-card" aria-live="polite">
            <div className="home-empty-icon">
              <IconBowlEmpty />
            </div>
            <p className="home-empty-title">Todavía no tienes ningún almuerzo</p>
            <p className="home-empty-desc">
              Añade el primero para empezar a llevar un registro.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <ul className="home-recent-list">
            {displayedRecents.map((a) => {
              const firstPhoto = a.photo_paths?.[0] ?? null
              return (
                <li key={a.id}>
                  <Link to={`/almuerzo/${a.id}`} className="home-history-card">
                    <div className="home-history-card-header">
                      <HistoryCardAvatar photoPath={firstPhoto} />
                      <div className="home-history-text">
                        <span className="home-history-bar">{a.bar_name}</span>
                        <span className="home-history-city">{barLocationLine(a.bar_formatted_address)}</span>
                        <div className="home-history-date">
                          <IconHistoryCalendar className="home-history-date-icon" />
                          <span className="home-history-date-text">{formatFechaLarga(a.meal_date)}</span>
                        </div>
                      </div>
                      <IconChevron className="home-history-chevron" />
                    </div>
                    <div className="home-history-divider-wrap" aria-hidden>
                      <span className="home-history-divider" />
                    </div>
                    <div className="home-history-summary">
                      <IconHistoryBurger className="home-history-burger-icon" />
                      <p className="home-history-summary-text">{nomBocadilloResum(a)}</p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <footer className="home-footer">
        <button type="button" className="home-sign-out" onClick={() => signOut()}>
          Cerrar sesión
        </button>
      </footer>
    </main>
  )
}
